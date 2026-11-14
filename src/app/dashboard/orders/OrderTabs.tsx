"use client";

import { useState } from "react";
import Link from "next/link";
import { formatBangkokDateTime } from "@/lib/bangkok-date";

type Order = {
  id: string;
  buyer_name: string | null;
  buyer_email: string | null;
  payment_method: string | null;
  price_cents: number;
  status: string;
  created_at: string;
  products: { name: string } | null;
};

export function OrderTabs({ orders }: { orders: Order[] }) {
  const [tab, setTab] = useState<"all" | "paid" | "pending" | "refunded">("all");

  const filtered = orders.filter((o) => tab === "all" || o.status === tab);

  return (
    <div>
      <div className="flex gap-2">
        {[
          { key: "all", label: "ทั้งหมด" },
          { key: "paid", label: "ชำระแล้ว" },
          { key: "pending", label: "รอชำระ" },
          { key: "refunded", label: "คืนเงิน" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`rounded-lg border px-4 py-2 text-xs font-medium ${
              tab === t.key
                ? "border-accent bg-accent text-paper"
                : "border-line text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {filtered.map((o) => (
          <Link
            key={o.id}
            href={`/dashboard/orders/${o.id}`}
            className="flex items-center justify-between rounded-xl border border-line bg-paper p-4 text-sm transition hover:border-ink/25"
          >
            <div>
              <p className="font-medium text-ink">{o.products?.name ?? "สินค้า"}</p>
              <p className="text-xs text-muted">
                {formatBangkokDateTime(new Date(o.created_at))} ·{" "}
                {o.status === "paid" ? "ชำระแล้ว" : o.status === "pending" ? "รอชำระ" : o.status === "refunded" ? "คืนเงิน" : "ไม่สำเร็จ"}
              </p>
            </div>
            <span className="font-semibold text-ink">
              +฿{(o.price_cents / 100).toLocaleString("th-TH")}
            </span>
          </Link>
        ))}

        {filtered.length === 0 && (
          <div className="flex min-h-44 items-center justify-center rounded-2xl border border-dashed border-line text-sm text-muted">
            ยังไม่มีออเดอร์
          </div>
        )}
      </div>
    </div>
  );
}
