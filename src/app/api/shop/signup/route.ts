import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Customer signup with a password.
 *
 * The email-code path still exists, but it depends on the provider's magic-link
 * template and on the recipient's mail client not pre-fetching single-use links
 * (Gmail does, which silently burns the token). A password account has no such
 * dependency, so this is the path customers are steered to by default.
 */
export async function POST(request: NextRequest) {
  const { name, email, password } = (await request.json()) as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json(
      { code: "missing_fields", error: "Name, email and password are all required." },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { code: "weak_password", error: "Use at least 8 characters for your password." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { name: name.trim(), role: "customer" },
  });

  if (createError || !created.user) {
    const message = createError?.message ?? "Could not create account";
    const alreadyExists = /already|registered|exists/i.test(message);
    return NextResponse.json(
      {
        code: alreadyExists ? "email_taken" : "signup_failed",
        error: alreadyExists ? "An account with that email already exists." : message,
      },
      { status: 400 },
    );
  }

  // `handle_new_user` creates the profile row from the trigger; make sure the
  // role landed even if metadata was dropped.
  await admin
    .from("profiles")
    .update({ role: "customer", name: name.trim() })
    .eq("id", created.user.id);

  return NextResponse.json({ ok: true });
}
