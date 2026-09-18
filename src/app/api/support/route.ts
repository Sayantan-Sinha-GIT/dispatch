import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Customer raises a support ticket, optionally attached to a specific order. */
export async function POST(request: NextRequest) {
  const { subject, message, orderId } = (await request.json()) as {
    subject?: string;
    message?: string;
    orderId?: string | null;
  };

  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json(
      { code: "missing_fields", error: "Add a subject and a message." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "not_signed_in", error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { data: ticket, error } = await admin
    .from("support_tickets")
    .insert({
      customer_id: user.id,
      order_id: orderId ?? null,
      subject: subject.trim(),
      message: message.trim(),
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ code: "ticket_failed", error: error.message }, { status: 500 });
  }

  const { data: profile } = await admin.from("profiles").select("name").eq("id", user.id).single();
  const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
  for (const a of admins ?? []) {
    await admin.from("notifications").insert({
      profile_id: a.id,
      type: "support_ticket",
      title: "New support request",
      body: `${profile?.name ?? "A customer"}: ${subject.trim()}`,
      related_order_id: orderId ?? null,
    });
  }

  return NextResponse.json({ ok: true, ticketId: ticket.id });
}

/** Admin resolves a ticket with a reply. */
export async function PATCH(request: NextRequest) {
  const { ticketId, reply } = (await request.json()) as { ticketId?: string; reply?: string };
  if (!ticketId) {
    return NextResponse.json({ code: "missing_fields", error: "Missing ticket" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "not_signed_in", error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") {
    return NextResponse.json({ code: "admin_only", error: "Admin only" }, { status: 403 });
  }

  const { data: ticket } = await admin
    .from("support_tickets")
    .select("customer_id, subject")
    .eq("id", ticketId)
    .maybeSingle();

  const { error } = await admin
    .from("support_tickets")
    .update({
      status: "resolved",
      admin_reply: reply?.trim() || null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  if (error) return NextResponse.json({ code: "update_failed", error: error.message }, { status: 500 });

  if (ticket?.customer_id) {
    await admin.from("notifications").insert({
      profile_id: ticket.customer_id,
      type: "support_reply",
      title: "Support replied",
      body: reply?.trim() || `Your request "${ticket.subject}" was resolved.`,
    });
  }

  return NextResponse.json({ ok: true });
}
