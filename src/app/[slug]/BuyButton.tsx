"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function BuyButton({
  productId,
  shopId,
  priceCents,
}: {
  productId: string;
  shopId: string;
  priceCents: number;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  async function handleBuy() {
    setState("loading");
    const supabase = createClient();
    await supabase.from("orders").insert({
      shop_id: shopId,
      product_id: productId,
      price_cents: priceCents,
      status: "paid",
    });
    setState("done");
  }

  if (state === "done") {
    return (
      <span className="shrink-0 rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink-soft">
        ซื้อแล้ว ✓
      </span>
    );
  }

  return (
    <button
      onClick={handleBuy}
      disabled={state === "loading"}
      className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper transition hover:opacity-85 disabled:opacity-60"
    >
      {state === "loading" ? "..." : "ซื้อ (ทดลอง)"}
    </button>
  );
}
