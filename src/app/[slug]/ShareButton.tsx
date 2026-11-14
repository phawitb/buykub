"use client";

import { useState } from "react";

export function ShareButton({ url, title, label = "แชร์ร้าน" }: {
  url: string;
  title: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"copied" | "error" | null>(null);

  async function handleShare() {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ url, title });
          return;
        } catch (error) {
          if (error && typeof error === "object" && "name" in error && error.name === "AbortError") return;
        }
      }
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={handleShare}
        disabled={busy}
        aria-label={label}
        title={label}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-muted shadow-lift-1 transition hover:bg-paper-dim hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
        </svg>
      </button>
      {status === "copied" && <p role="status" className="absolute right-0 top-full z-20 mt-2 whitespace-nowrap rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink shadow-lift-2">คัดลอกลิงก์แล้ว</p>}
      {status === "error" && <div className="absolute right-0 top-full z-20 mt-2 w-60 max-w-[calc(100vw-3rem)] rounded-lg border border-line bg-paper p-3 text-xs text-ink shadow-lift-2">
        <p role="alert">คัดลอกลิงก์ไม่สำเร็จ เลือกลิงก์ด้านล่างเพื่อคัดลอกเอง</p>
        <input aria-label="ลิงก์สำหรับแชร์" value={url} readOnly onFocus={(event) => event.currentTarget.select()} className="mt-2 w-full rounded border border-line bg-paper-dim p-2 text-xs" />
      </div>}
    </div>
  );
}
