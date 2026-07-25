"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  kind: string;
  published: boolean;
};

export function ProductRow({ product }: { product: Product }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function togglePublished() {
    setBusy(true);
    const supabase = createClient();
    await supabase
      .from("products")
      .update({ published: !product.published })
      .eq("id", product.id);
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("products").delete().eq("id", product.id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-paper p-4">
      <div>
        <p className="font-medium text-ink">
          {product.name}{" "}
          <span className="ml-1 text-xs font-normal text-muted">
            {product.kind === "booking" ? "· บริการจอง" : "· ดิจิทัล"}
          </span>
        </p>
        {product.description && (
          <p className="mt-0.5 text-sm text-ink-soft">{product.description}</p>
        )}
        <p className="mt-1 text-sm font-semibold text-ink">
          ฿{(product.price_cents / 100).toLocaleString("th-TH")}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={togglePublished}
          disabled={busy}
          className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-soft hover:text-ink disabled:opacity-50"
        >
          {product.published ? "เผยแพร่อยู่" : "ซ่อนอยู่"}
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
