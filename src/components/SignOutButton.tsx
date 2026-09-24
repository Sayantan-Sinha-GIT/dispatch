"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import { LogoutIcon } from "@/components/admin/icons";

/**
 * Sign out, on every signed-in screen and at every width. It sits in the
 * portal bar with an icon and a word, so it is never hidden on a phone and
 * never reduced to an unlabelled glyph.
 */
export function SignOutButton({ role }: { role: "customer" | "rider" | "admin" }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await createClient().auth.signOut();
    router.replace(`/login?role=${role}`);
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      disabled={busy}
      className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-2 text-sm text-text-dim ring-1 ring-border transition-colors hover:bg-danger/10 hover:text-danger hover:ring-danger/30 disabled:opacity-50"
    >
      <LogoutIcon className="h-4 w-4" />
      {t("shop.signOut")}
    </button>
  );
}
