import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data } = await admin.from("products").select("*").order("category").order("name");
  return NextResponse.json({ products: data ?? [] });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const unit = typeof body.unit === "string" ? body.unit.trim() : "";
  const price = body.price;
  if (!name || !category || !unit || price == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (name.length > 120 || category.length > 40 || unit.length > 30) {
    return NextResponse.json({ error: "Name, category or unit is too long" }, { status: 400 });
  }
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: "Price must be a positive number" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("products")
    .insert({
      name,
      category,
      unit,
      price,
      // A product can be created as a draft and listed once its photo is in.
      is_listed: body.is_listed !== false,
      image_gradient: "from-slate-700 to-slate-900",
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}
