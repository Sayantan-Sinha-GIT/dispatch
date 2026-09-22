import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDispatchTick } from "@/lib/dispatch";

const DELIVERY_FEE = 25;

/** 409 with a code the cart translates, naming the item and how many are left. */
function stockError(name: string, available: number) {
  const error =
    available > 0 ? `Only ${available} of ${name} left — lower the quantity` : `${name} just sold out — remove it from your cart`;
  return NextResponse.json({ code: "out_of_stock", name, available, error }, { status: 409 });
}

export async function POST(request: NextRequest) {
  const { items, address, lat, lng } = (await request.json()) as {
    items: { productId: string; qty: number }[];
    address: string;
    lat: number;
    lng: number;
  };

  if (!items?.length || !address || lat == null || lng == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const hasInvalidQty = items.some((i) => !Number.isInteger(i.qty) || i.qty <= 0 || i.qty > 50);
  if (hasInvalidQty) {
    return NextResponse.json({ error: "Item quantities must be whole numbers between 1 and 50" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role, name").eq("id", user.id).single();
  if (profile?.role !== "customer") {
    return NextResponse.json({ error: "Only customer accounts can place orders" }, { status: 403 });
  }

  // Never trust client-supplied prices — reprice server-side from the catalog.
  const ids = items.map((i) => i.productId);
  const { data: products } = await admin.from("products").select("*").in("id", ids);
  if (!products || products.length !== ids.length) {
    return NextResponse.json({ error: "One of these items is no longer available" }, { status: 400 });
  }

  const priced = items.map((i) => {
    const product = products.find((p) => p.id === i.productId)!;
    return { product_id: product.id, name: product.name, unit: product.unit, price: product.price, qty: i.qty };
  });
  // A cart can outlive a listing: the customer added it, then an admin took
  // it off the shop. The service-role query above still sees it, so check.
  const delisted = products.find((p) => !p.is_listed);
  if (delisted) {
    return NextResponse.json({ error: `${delisted.name} is no longer sold — remove it from your cart` }, { status: 400 });
  }
  // A friendly early answer. The database trigger that takes the stock is the
  // real guard: two customers checking out the last one at once can both pass
  // this line, and only one of them gets past the trigger.
  const wanted = new Map<string, number>();
  for (const i of items) wanted.set(i.productId, (wanted.get(i.productId) ?? 0) + i.qty);
  const short = products.find((p) => p.stock_qty < (wanted.get(p.id) ?? 0));
  if (short) return stockError(short.name, short.stock_qty);

  const subtotal = priced.reduce((sum, p) => sum + p.price * p.qty, 0);
  const totalWeight = priced.reduce((sum, p) => sum + p.qty, 0);
  const total = subtotal + DELIVERY_FEE;

  const { data: order, error } = await admin
    .from("orders")
    .insert({
      raw_text: `Customer order (${profile.name}): ${priced.map((p) => `${p.qty}x ${p.name}`).join(", ")} → ${address}`,
      address,
      lat,
      lng,
      weight: totalWeight,
      customer_id: user.id,
      source: "customer",
      items: priced,
      subtotal,
      delivery_fee: DELIVERY_FEE,
      total_amount: total,
      status: "pending",
    })
    .select("*")
    .single();

  if (error?.hint === "out_of_stock") {
    const { name, available } = JSON.parse(error.details ?? "{}") as { name?: string; available?: number };
    return stockError(name ?? "An item", available ?? 0);
  }
  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? "Could not place order" }, { status: 500 });
  }

  const { error: eventError } = await admin.from("order_events").insert({
    order_id: order.id,
    event_type: "placed",
    actor_role: "customer",
    actor_id: user.id,
    detail: `Order placed — ${priced.length} item(s), ₹${total}`,
  });
  if (eventError) console.error("order_events insert failed", eventError);

  // Every assignment goes through the routing engine, including this one: the
  // tick re-plans the whole pending pool with the new order in it rather than
  // grabbing whichever rider happens to be nearest to it alone.
  await runDispatchTick(admin);

  return NextResponse.json({ orderId: order.id });
}
