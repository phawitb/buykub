"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function BookButton({
  serviceId,
  shopId,
  priceCents,
}: {
  serviceId: string;
  shopId: string;
  priceCents: number;
}) {
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  async function handleBook() {
    if (!when) return;
    setState("loading");
    const supabase = createClient();
    await supabase.from("bookings").insert({
      shop_id: shopId,
      service_id: serviceId,
      scheduled_at: new Date(when).toISOString(),
      price_cents: priceCents,
    });
    setState("done");
  }

  if (state === "done") {
    return (
      <span className="shrink-0 rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink-soft">
        จองแล้ว ✓
      </span>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper transition hover:opacity-85"
      >
        จอง (ทดลอง)
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <input
        type="datetime-local"
        value={when}
        onChange={(e) => setWhen(e.target.value)}
        className="rounded-lg border border-line bg-paper px-2 py-1.5 text-xs text-ink outline-none focus:border-ink"
      />
      <button
        onClick={handleBook}
        disabled={state === "loading" || !when}
        className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper transition hover:opacity-85 disabled:opacity-60"
      >
        {state === "loading" ? "..." : "ยืนยัน"}
      </button>
    </div>
  );
}
