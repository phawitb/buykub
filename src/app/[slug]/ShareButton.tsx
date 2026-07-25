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
      className="rounded-full border border-line bg-paper/90 px-4 py-1.5 text-xs font-medium text-ink-soft backdrop-blur hover:text-ink"
    >
      {copied ? "คัดลอกแล้ว ✓" : "แชร์ร้าน"}
    </button>
  );
}
