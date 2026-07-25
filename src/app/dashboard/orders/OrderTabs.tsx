"use client";

import { useState } from "react";

type Order = {
  id: string;
  price_cents: number;
  status: string;
  created_at: string;
  products: { name: string } | null;
};

export function OrderTabs({ orders }: { orders: Order[] }) {
  const [tab, setTab] = useState<"all" | "paid" | "refunded">("all");

  const filtered = orders.filter((o) => tab === "all" || o.status === tab);

  return (
    <div>
      <div className="flex gap-2">
        {[
          { key: "all", label: "ทั้งหมด" },
          { key: "paid", label: "ชำระแล้ว" },
          { key: "refunded", label: "คืนเงิน" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium ${
              tab === t.key
                ? "border-ink bg-ink text-paper"
                : "border-line text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {filtered.map((o) => (
          <div
            key={o.id}
            className="flex items-center justify-between rounded-xl border border-line bg-paper p-4 text-sm"
          >
            <div>
              <p className="font-medium text-ink">{o.products?.name ?? "สินค้า"}</p>
              <p className="text-xs text-muted">
                {new Date(o.created_at).toLocaleString("th-TH")} ·{" "}
                {o.status === "paid" ? "ชำระแล้ว" : "คืนเงิน"}
              </p>
            </div>
            <span className="font-semibold text-ink">
              +฿{(o.price_cents / 100).toLocaleString("th-TH")}
            </span>
          </div>
        ))}

        {filtered.length === 0 && <p className="text-sm text-muted">ยังไม่มีออเดอร์</p>}
      </div>
    </div>
  );
}
