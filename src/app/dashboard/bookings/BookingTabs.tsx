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
    <div className="mt-7">
      <div className="flex border-b border-line" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "services"}
          onClick={() => setTab("services")}
          className={`border-b-2 px-5 py-3 text-sm font-semibold transition ${
            tab === "services"
              ? "border-ink text-ink"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          บริการ
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "incoming"}
          onClick={() => setTab("incoming")}
          className={`border-b-2 px-5 py-3 text-sm font-semibold transition ${
            tab === "incoming"
              ? "border-ink text-ink"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          การจองที่เข้ามา
        </button>
      </div>
      <div className="pt-6">{tab === "services" ? services : incoming}</div>
    </div>
  );
}
