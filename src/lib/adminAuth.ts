import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Returns a service-role client if the caller is a signed-in admin, or null.
 *
 * The service-role client bypasses row-level security, so every admin route
 * must get it through this check rather than creating one directly.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? admin : null;
}

export const PRODUCT_IMAGE_BUCKET = "product-images";

/** The object path inside our bucket, or null for artwork shipped in /public. */
export function productImagePath(url: string | null | undefined) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}
