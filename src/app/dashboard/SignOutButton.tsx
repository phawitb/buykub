"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted hover:text-ink"
      title="ออกจากระบบ"
    >
      ออกจากระบบ
    </button>
  );
}
