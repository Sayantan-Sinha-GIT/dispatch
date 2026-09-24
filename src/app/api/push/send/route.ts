import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";

function secretMatches(given: string | null): boolean {
  const expected = process.env.PUSH_WEBHOOK_SECRET;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Called by the database (trigger notifications_push, via pg_net) for every
 * new notification, with a shared secret. Turns the notification into a push
 * to each of the recipient's phones, and forgets phones FCM no longer knows.
 */
export async function POST(request: NextRequest) {
  if (!secretMatches(request.headers.get("x-push-secret"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const admin = createAdminClient();
  const { data: n } = await admin
    .from("notifications")
    .select("id, profile_id, type, title, body, related_order_id")
    .eq("id", id)
    .single();
  if (!n) return NextResponse.json({ error: "No such notification" }, { status: 404 });

  const [{ data: tokens }, { data: profile }] = await Promise.all([
    admin.from("push_tokens").select("token").eq("profile_id", n.profile_id),
    admin.from("profiles").select("role").eq("id", n.profile_id).single(),
  ]);
  if (!tokens?.length) return NextResponse.json({ sent: 0 });

  // Tapping opens the screen the notification is about.
  const role = profile?.role;
  const url =
    role === "rider"
      ? "/rider"
      : role === "admin"
        ? "/admin"
        : n.related_order_id
          ? `/shop/orders/${n.related_order_id}`
          : "/shop/orders";

  const results = await sendPush(
    tokens.map((t) => t.token),
    {
      title: n.title,
      body: n.body ?? "",
      url,
      channel: n.type === "delivery_offer" ? "offers" : "updates",
      tag: n.related_order_id ?? undefined,
    },
  );
  const gone = results.filter((r) => r.gone).map((r) => r.token);
  if (gone.length) await admin.from("push_tokens").delete().in("token", gone);
  const failed = results.filter((r) => !r.ok && !r.gone);
  if (failed.length) console.error("[push] send failed", failed.map((f) => f.error));
  return NextResponse.json({ sent: results.filter((r) => r.ok).length, removed: gone.length, failed: failed.length });
}
