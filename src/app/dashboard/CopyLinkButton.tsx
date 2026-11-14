"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/icons";

export function CopyLinkButton({ text, iconOnly = false }: { text: string; iconOnly?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={iconOnly ? copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์ร้าน" : undefined}
      title={iconOnly ? copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์ร้าน" : undefined}
      className={iconOnly ? "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-muted transition hover:bg-paper-dim hover:text-ink" : "shrink-0 border-l border-line px-3 py-1.5 text-xs text-muted hover:text-ink"}
    >
      {iconOnly ? (
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {copied ? <path d="m5 12 4 4L19 6" /> : <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>}
        </svg>
      ) : copied ? <span className="inline-flex items-center gap-1.5"><CheckIcon className="size-3.5" />คัดลอกแล้ว</span> : "คัดลอก"}
    </button>
  );
}
