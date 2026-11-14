"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ProfileMenu } from "./ProfileMenu";

// Presentation only. Rendered over the landing photograph, so it is toned light. Every protected page still verifies the user on the server.
export function LandingAccount() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const { auth } = createClient();
    let active = true;
    let changed = false;
    const pending = auth.getUser();
    const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
      changed = true;
      if (active) setUser(session?.user ?? null);
    });
    void pending.then(({ data }) => {
      if (active && !changed) setUser(data.user);
    }).catch(() => undefined);
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  if (user) return <>
    <Link href="/dashboard/products" className="inline-flex h-10 items-center rounded-full border border-line bg-paper px-4 text-sm font-medium text-ink transition duration-[120ms] ease-out hover:border-line-strong hover:bg-paper-dim active:scale-[0.97]">ร้านของฉัน</Link>
    <ProfileMenu name={user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? ""} avatarUrl={user.user_metadata?.avatar_url ?? null} />
  </>;
  // These sit inside the dark navbar pill, so they are toned for that ground.
  return <>
    <Link href="/login" className="hidden h-9 items-center rounded-[4px] px-4 text-sm font-medium text-white transition-colors hover:bg-white/15 sm:inline-flex">เข้าสู่ระบบ</Link>
    <Link href="/login?next=%2Fdashboard%2Fproducts%3Fcreate%3D1" className="inline-flex h-9 items-center rounded-[4px] bg-white/90 px-4 text-sm font-medium text-ink backdrop-blur transition duration-[120ms] ease-out hover:bg-white active:scale-[0.97]">สร้างร้านฟรี</Link>
  </>;
}
