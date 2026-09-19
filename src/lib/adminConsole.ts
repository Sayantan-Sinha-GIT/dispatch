import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import type { ParsedOrder } from "@/lib/gemini";

/**
 * The admin command console turns one free-text instruction into a list of
 * concrete, validated actions. Gemini never touches the database directly and
 * never makes routing decisions — it only resolves the admin's words into ids
 * drawn from a snapshot we hand it, and the server re-validates everything.
 */

export const DESTRUCTIVE_KINDS = [
  "cancel_order",
  "delete_order",
  "suspend_rider",
  "set_order_status",
] as const;

/** The states an admin may move an order to by hand. */
export const SETTABLE_STATUSES = ["pending", "assigned", "delivered", "cancelled"] as const;

export type ConsoleActionKind =
  | "create_orders"
  | "cancel_order"
  | "delete_order"
  | "reassign_order"
  | "force_assign_order"
  | "mark_delivered"
  | "set_order_status"
  | "suspend_rider"
  | "unsuspend_rider"
  | "set_rider_capacity"
  | "run_dispatch"
  | "answer";

export interface ConsoleAction {
  kind: ConsoleActionKind;
  orderId?: string | null;
  riderId?: string | null;
  reason?: string | null;
  minutes?: number | null;
  capacity?: number | null;
  text?: string | null;
  status?: string | null;
  orders?: ParsedOrder[] | null;
}

export interface ConsolePlan {
  actions: ConsoleAction[];
  reply: string;
}

export interface OrderSnapshot {
  id: string;
  address: string;
  status: string;
  riderName: string | null;
  customerName: string | null;
  totalAmount: number | null;
  createdAt: string;
}

export interface RiderSnapshot {
  id: string;
  name: string;
  status: string;
  capacity: number;
  openOrders: number;
  suspended: boolean;
}

export function isDestructive(kind: ConsoleActionKind) {
  return (DESTRUCTIVE_KINDS as readonly string[]).includes(kind);
}

const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    reply: { type: SchemaType.STRING },
    actions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          kind: { type: SchemaType.STRING },
          orderId: { type: SchemaType.STRING, nullable: true },
          riderId: { type: SchemaType.STRING, nullable: true },
          reason: { type: SchemaType.STRING, nullable: true },
          minutes: { type: SchemaType.NUMBER, nullable: true },
          capacity: { type: SchemaType.NUMBER, nullable: true },
          text: { type: SchemaType.STRING, nullable: true },
          status: { type: SchemaType.STRING, nullable: true },
          orders: {
            type: SchemaType.ARRAY,
            nullable: true,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                address: { type: SchemaType.STRING },
                lat: { type: SchemaType.NUMBER },
                lng: { type: SchemaType.NUMBER },
                weight: { type: SchemaType.NUMBER },
                time_window_start: { type: SchemaType.STRING, nullable: true },
                time_window_end: { type: SchemaType.STRING, nullable: true },
              },
              required: ["address", "lat", "lng", "weight"],
            },
          },
        },
        required: ["kind"],
      },
    },
  },
  required: ["actions", "reply"],
};

function snapshotText(orders: OrderSnapshot[], riders: RiderSnapshot[]) {
  const orderLines = orders.length
    ? orders
        .map(
          (o) =>
            `- id=${o.id} | "${o.address}" | status=${o.status} | rider=${o.riderName ?? "none"} | customer=${o.customerName ?? "walk-in"} | total=${o.totalAmount ?? "-"}`,
        )
        .join("\n")
    : "(no orders)";

  const riderLines = riders.length
    ? riders
        .map(
          (r) =>
            `- id=${r.id} | "${r.name}" | ${r.status}${r.suspended ? " (SUSPENDED)" : ""} | capacity=${r.capacity} | currently holding ${r.openOrders}`,
        )
        .join("\n")
    : "(no riders)";

  return `CURRENT ORDERS:\n${orderLines}\n\nCURRENT RIDERS:\n${riderLines}`;
}

export async function planFromCommand(
  command: string,
  orders: OrderSnapshot[],
  riders: RiderSnapshot[],
): Promise<ConsolePlan> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash-lite",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      maxOutputTokens: 4096,
    },
  });

  const prompt = `You are the dispatch command console for a hyperlocal delivery service.
An admin types an instruction in plain English or Hindi. You translate it into concrete actions.

You may ONLY use ids that appear in the snapshot below. Never invent an id.
If the admin's instruction is ambiguous or refers to something not in the snapshot,
return zero actions and explain the problem in "reply".

Available action kinds:
- "create_orders": add new delivery orders. Put them in the "orders" array with address, lat, lng (best-effort real-world coordinates), weight in kg (default 1), and optional time_window_start/time_window_end as "HH:MM".
- "cancel_order": cancel an order. Needs orderId. Optional reason.
- "delete_order": permanently remove an order record. Needs orderId. Prefer cancel_order unless the admin explicitly says delete/remove the record.
- "reassign_order": pull an order back to the pending pool so the optimizer re-plans it. Needs orderId.
- "force_assign_order": send a specific order to a specific rider. Needs orderId AND riderId.
- "mark_delivered": mark an order delivered. Needs orderId.
- "set_order_status": move an order to a specific state by hand. Needs orderId and status, one of: pending, assigned, delivered, cancelled. Use this when the admin names a state explicitly ("set order X back to pending", "mark this one as not delivered", "put it back on the road"). "not delivered" / "never arrived" means status "pending" so the order is re-planned to a rider.
- "suspend_rider": block a rider from new offers. Needs riderId and minutes (default 30).
- "unsuspend_rider": lift a suspension. Needs riderId.
- "set_rider_capacity": change how many orders a rider can hold. Needs riderId and capacity.
- "run_dispatch": re-run route optimization across all pending orders. No other fields.
- "answer": the admin asked a question rather than requesting a change. Put the answer in "text", using only facts from the snapshot.

Rules:
- You extract and resolve only. You never decide delivery sequence or which rider is "best" — that is the routing engine's job. If the admin says "assign this to whoever is free", use "run_dispatch", not force_assign_order.
- Multiple actions are allowed when the admin asks for several things at once.
- "reply" is a short, friendly confirmation of what you are about to do, in the same language the admin used.

${snapshotText(orders, riders)}

ADMIN INSTRUCTION:
"""
${command}
"""`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonText = text.startsWith("```")
    ? text.replace(/^```[a-z]*\n?/, "").replace(/```$/, "")
    : text;

  const parsed = JSON.parse(jsonText) as ConsolePlan;
  return {
    reply: parsed.reply ?? "",
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
  };
}

/**
 * Re-validates a plan against the snapshot the server just loaded. This runs on
 * both the planning pass and the confirm pass, so a tampered client payload
 * can't smuggle in an id the admin never saw.
 */
export function validateActions(
  actions: ConsoleAction[],
  orders: OrderSnapshot[],
  riders: RiderSnapshot[],
): { valid: ConsoleAction[]; rejected: string[] } {
  const orderIds = new Set(orders.map((o) => o.id));
  const riderIds = new Set(riders.map((r) => r.id));
  const valid: ConsoleAction[] = [];
  const rejected: string[] = [];

  for (const action of actions) {
    const needsOrder = [
      "cancel_order",
      "delete_order",
      "reassign_order",
      "force_assign_order",
      "mark_delivered",
      "set_order_status",
    ].includes(action.kind);
    const needsRider = ["force_assign_order", "suspend_rider", "unsuspend_rider", "set_rider_capacity"].includes(
      action.kind,
    );

    if (needsOrder && (!action.orderId || !orderIds.has(action.orderId))) {
      rejected.push(`${action.kind}: unknown order`);
      continue;
    }
    if (needsRider && (!action.riderId || !riderIds.has(action.riderId))) {
      rejected.push(`${action.kind}: unknown rider`);
      continue;
    }
    // The model occasionally puts a numeric argument in the wrong slot, so
    // read the intended field first but fall back to the other numeric one
    // before rejecting. The value is echoed in any rejection so a bad parse is
    // diagnosable instead of just "invalid".
    if (action.kind === "set_rider_capacity") {
      const raw = action.capacity ?? action.minutes;
      const cap = Math.round(Number(raw));
      if (!Number.isFinite(cap) || cap < 1 || cap > 20) {
        rejected.push(`set_rider_capacity: capacity must be 1–20 (got ${JSON.stringify(raw)})`);
        continue;
      }
      action.capacity = cap;
      action.minutes = null;
    }
    if (action.kind === "suspend_rider") {
      const raw = action.minutes ?? action.capacity ?? 30;
      const mins = Math.round(Number(raw));
      if (!Number.isFinite(mins) || mins < 1 || mins > 1440) {
        rejected.push(`suspend_rider: minutes must be 1–1440 (got ${JSON.stringify(raw)})`);
        continue;
      }
      action.minutes = mins;
    }
    if (action.kind === "set_order_status") {
      const status = (action.status ?? "").trim().toLowerCase();
      if (!(SETTABLE_STATUSES as readonly string[]).includes(status)) {
        rejected.push(
          `set_order_status: status must be one of ${SETTABLE_STATUSES.join(", ")} (got ${JSON.stringify(action.status)})`,
        );
        continue;
      }
      action.status = status;
    }
    if (action.kind === "create_orders" && (!action.orders || action.orders.length === 0)) {
      rejected.push("create_orders: no orders were extracted");
      continue;
    }

    valid.push(action);
  }

  return { valid, rejected };
}

/** Short human label for an action, shown in the confirmation card and audit log. */
export function describeAction(
  action: ConsoleAction,
  orders: OrderSnapshot[],
  riders: RiderSnapshot[],
): string {
  const order = orders.find((o) => o.id === action.orderId);
  const rider = riders.find((r) => r.id === action.riderId);
  const orderLabel = order ? `"${order.address}"` : "an order";
  const riderLabel = rider ? rider.name : "a rider";

  switch (action.kind) {
    case "create_orders":
      return `Create ${action.orders?.length ?? 0} order(s)`;
    case "cancel_order":
      return `Cancel ${orderLabel}${action.reason ? ` — ${action.reason}` : ""}`;
    case "delete_order":
      return `Permanently delete ${orderLabel}`;
    case "reassign_order":
      return `Return ${orderLabel} to the pending pool`;
    case "force_assign_order":
      return `Send ${orderLabel} to ${riderLabel}`;
    case "mark_delivered":
      return `Mark ${orderLabel} delivered`;
    case "set_order_status":
      return `Set ${orderLabel} to "${action.status}"`;
    case "suspend_rider":
      return `Suspend ${riderLabel} for ${action.minutes ?? 30} minutes`;
    case "unsuspend_rider":
      return `Lift suspension on ${riderLabel}`;
    case "set_rider_capacity":
      return `Set ${riderLabel}'s capacity to ${action.capacity}`;
    case "run_dispatch":
      return "Re-run route optimization";
    case "answer":
      return "Answer a question";
    default:
      return action.kind;
  }
}
