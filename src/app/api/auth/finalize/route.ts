import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finalizeRole, type AuthIntent } from "@/lib/authFinalize";

export async function POST(request: NextRequest) {
  const { intent } = (await request.json()) as { intent: AuthIntent };
  if (intent !== "customer" && intent !== "rider") {
    return NextResponse.json({ error: "Invalid intent" }, { status: 400 });
  }

  const supabase = await createClient();
  const result = await finalizeRole(supabase, intent);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json(result);
}
