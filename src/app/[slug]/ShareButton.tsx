"use client";

import { useState } from "react";

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center rounded-full border border-line bg-paper px-3.5 py-1.5 font-mono text-[11px] font-medium text-ink-soft shadow-[0_2px_8px_rgba(24,24,27,0.08)] transition hover:border-ink hover:text-ink"
    >
      {copied ? "คัดลอกแล้ว ✓" : "แชร์ร้าน"}
    </button>
  );
}
