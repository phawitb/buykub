"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShopIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

/**
 * A way back to the dashboard from public pages, for whoever is signed in.
 * Storefront pages are cached and shared by every visitor, so the signed-in
 * state is read here in the browser and the page itself stays the same for all.
 */
export function DashboardShortcut() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const { auth } = createClient();
    let active = true;
    let changed = false;
    const pending = auth.getUser();
    const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
      changed = true;
      if (active) setSignedIn(Boolean(session?.user));
    });
    void pending.then(({ data }) => {
      if (active && !changed) setSignedIn(Boolean(data.user));
    }).catch(() => undefined);
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  if (!signedIn) return null;
  return (
    <Link
      href="/dashboard/products"
      title="ไปที่แดชบอร์ดของฉัน"
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-paper px-3 text-xs font-semibold text-ink shadow-lift-1 transition hover:bg-paper-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <ShopIcon className="size-4" />
      แดชบอร์ด
    </Link>
  );
}
