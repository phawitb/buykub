"use client";

import { useState, type ReactNode } from "react";

export function BookingTabs({
  services,
  incoming,
}: {
  services: ReactNode;
  incoming: ReactNode;
}) {
  const [tab, setTab] = useState<"services" | "incoming">("services");

  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 rounded-xl bg-paper-dim p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "services"}
          onClick={() => setTab("services")}
          className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
            tab === "services"
              ? "bg-paper text-ink shadow-sm"
              : "text-muted hover:text-ink"
          }`}
        >
          บริการ
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "incoming"}
          onClick={() => setTab("incoming")}
          className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
            tab === "incoming"
              ? "bg-paper text-ink shadow-sm"
              : "text-muted hover:text-ink"
          }`}
        >
          การจองที่เข้ามา
        </button>
      </div>
      <div className="pt-5">{tab === "services" ? services : incoming}</div>
    </div>
  );
}
