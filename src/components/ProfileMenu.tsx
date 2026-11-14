"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ProfileMenu({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-paper-dim"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="size-8 rounded-full object-cover" />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-ink text-xs font-medium text-on-ink">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="sr-only">{name}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-container border border-line bg-paper p-1 shadow-lift-3">
          <Link
            href="/dashboard/products"
            onClick={() => setOpen(false)}
            className="block rounded-inner px-3.5 py-2.5 text-sm text-ink-soft transition-colors hover:bg-paper-dim hover:text-ink"
          >
            บัญชีของฉัน
          </Link>
          <button
            onClick={handleSignOut}
            className="block w-full rounded-inner px-3.5 py-2.5 text-left text-sm text-ink-soft transition-colors hover:bg-paper-dim hover:text-ink"
          >
            ออกจากระบบ
          </button>
        </div>
      )}
    </div>
  );
}
