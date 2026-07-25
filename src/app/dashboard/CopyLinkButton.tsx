"use client";

import { useState } from "react";

export function CopyLinkButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft hover:text-ink"
    >
      {copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}
    </button>
  );
}
