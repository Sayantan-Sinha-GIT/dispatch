import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: customers } = await admin
    .from("profiles")
    .select("*")
    .eq("role", "customer")
    .order("created_at", { ascending: false });

  const { data: orders } = await admin.from("orders").select("customer_id, total_amount, status").eq("source", "customer");

  const stats = new Map<string, { count: number; spent: number }>();
  for (const o of orders ?? []) {
    if (!o.customer_id) continue;
    const s = stats.get(o.customer_id) ?? { count: 0, spent: 0 };
    s.count += 1;
    if (o.status === "delivered") s.spent += o.total_amount ?? 0;
    stats.set(o.customer_id, s);
  }

  const result = (customers ?? []).map((c) => ({
    ...c,
    order_count: stats.get(c.id)?.count ?? 0,
    total_spent: stats.get(c.id)?.spent ?? 0,
  }));

  return NextResponse.json({ customers: result });
}
