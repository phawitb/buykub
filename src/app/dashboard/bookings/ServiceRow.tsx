"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Service = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
  published: boolean;
};

export function ServiceRow({ service }: { service: Service }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function togglePublished() {
    setBusy(true);
    const supabase = createClient();
    await supabase
      .from("services")
      .update({ published: !service.published })
      .eq("id", service.id);
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("services").delete().eq("id", service.id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-paper p-4">
      <div>
        <p className="font-medium text-ink">
          {service.name}{" "}
          <span className="ml-1 text-xs font-normal text-muted">
            · {service.duration_minutes} นาที
          </span>
        </p>
        {service.description && (
          <p className="mt-0.5 text-sm text-ink-soft">{service.description}</p>
        )}
        <p className="mt-1 text-sm font-semibold text-ink">
          ฿{(service.price_cents / 100).toLocaleString("th-TH")}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={togglePublished}
          disabled={busy}
          className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-soft hover:text-ink disabled:opacity-50"
        >
          {service.published ? "เผยแพร่อยู่" : "ซ่อนอยู่"}
        </button>
        <button
          onClick={remove}
          disabled={busy}
          className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-soft hover:text-ink disabled:opacity-50"
        >
          ลบ
        </button>
      </div>
    </div>
  );
}
