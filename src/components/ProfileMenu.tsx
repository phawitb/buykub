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
        className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 hover:bg-paper-dim"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="max-w-[8rem] truncate text-sm font-medium text-ink">{name}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-line bg-paper shadow-lg">
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-ink-soft hover:bg-paper-dim hover:text-ink"
          >
            แดชบอร์ด
          </Link>
          <button
            onClick={handleSignOut}
            className="block w-full px-4 py-2.5 text-left text-sm text-ink-soft hover:bg-paper-dim hover:text-ink"
          >
            ออกจากระบบ
          </button>
        </div>
      )}
    </div>
  );
}
