import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_IMAGE_BUCKET, productImagePath, requireAdmin } from "@/lib/adminAuth";
import type { TablesUpdate } from "@/lib/supabase/types";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const patch: TablesUpdate<"products"> = {};
  for (const key of ["name", "category", "unit"] as const) {
    if (key in body) {
      const value = typeof body[key] === "string" ? body[key].trim() : "";
      if (!value) return NextResponse.json({ error: `${key} can't be empty` }, { status: 400 });
      patch[key] = value;
    }
  }
  if ("in_stock" in body) patch.in_stock = !!body.in_stock;
  if ("is_listed" in body) patch.is_listed = !!body.is_listed;
  if ("price" in body) {
    if (typeof body.price !== "number" || !Number.isFinite(body.price) || body.price <= 0) {
      return NextResponse.json({ error: "Price must be a positive number" }, { status: 400 });
    }
    patch.price = body.price;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await admin.from("products").update(patch).eq("id", id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  return NextResponse.json({ product: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: product } = await admin.from("products").select("image_url").eq("id", id).maybeSingle();
  const { error } = await admin.from("products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Past orders keep their own copy of name and price, so the photo is the
  // only thing left pointing at this product. Remove it with the row.
  const path = productImagePath(product?.image_url);
  if (path) await admin.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);

  return NextResponse.json({ ok: true });
}
