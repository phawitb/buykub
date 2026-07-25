"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { deleteShopAsset } from "@/lib/supabase/upload";

type Service = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
  published: boolean;
  image_path: string | null;
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
    if (!window.confirm(`ลบบริการ “${service.name}” ใช่ไหม? การจองที่เกี่ยวข้องจะถูกลบด้วย`)) {
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("services").delete().eq("id", service.id);
    if (!error && service.image_path) {
      await deleteShopAsset("product-image", service.image_path).catch(() => undefined);
    }
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
        <Link
          href={`/dashboard/bookings/${service.id}/edit`}
          className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-soft hover:text-ink"
        >
          แก้ไข
        </Link>
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
