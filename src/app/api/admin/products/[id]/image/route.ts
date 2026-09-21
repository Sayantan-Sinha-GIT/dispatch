import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_IMAGE_BUCKET, productImagePath, requireAdmin } from "@/lib/adminAuth";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * The file's real type, read from its first bytes. The browser's claimed MIME
 * type and the file name are both under the uploader's control, so neither is
 * trusted on its own.
 */
function sniff(bytes: Uint8Array): { type: string; ext: string } | null {
  const b = (i: number) => bytes[i];
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return { type: "image/png", ext: "png" };
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { type: "image/webp", ext: "webp" };
  return null;
}

/** Uploads or replaces a product's photograph. Body: multipart form, field `file`. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: product } = await admin.from("products").select("id, image_url").eq("id", id).maybeSingle();
  if (!product) return NextResponse.json({ code: "not_found", error: "Product not found" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ code: "no_file", error: "Choose an image to upload" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ code: "too_large", error: "Images must be 5 MB or smaller" }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) {
    return NextResponse.json({ code: "bad_type", error: "Use a JPEG, PNG or WebP image" }, { status: 415 });
  }

  // A fresh name each time, so browsers and the image optimiser never serve a
  // stale cached copy of the previous photo.
  const path = `${id}/${Date.now()}.${kind.ext}`;
  const { error: uploadError } = await admin.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, bytes, { contentType: kind.type, upsert: false, cacheControl: "31536000" });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: pub } = admin.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  const { error: updateError } = await admin.from("products").update({ image_url: pub.publicUrl }).eq("id", id);
  if (updateError) {
    await admin.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Only now that the new photo is live, remove the one it replaced.
  const previous = productImagePath(product.image_url);
  if (previous) await admin.storage.from(PRODUCT_IMAGE_BUCKET).remove([previous]);

  return NextResponse.json({ imageUrl: pub.publicUrl });
}
