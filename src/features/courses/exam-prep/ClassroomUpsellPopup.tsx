"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { formatTHB } from "@/features/products/format";
import type { ClassroomUpsell } from "./upsell";

export const UPSELL_FIRST_MS = 8000;
export const UPSELL_AGAIN_MS = 10 * 60 * 1000;
export const UPSELL_POLL_MS = 2000;

/** A running mock set is under way; the ad never interrupts one. */
export const busyHash = (hash: string) => /^#mock-/.test(hash);
/** The engine marks its root while an unanswered question is on screen. */
const busy = () => busyHash(window.location.hash) || !!document.querySelector(".exam-prep[data-busy]");

/**
 * The free classroom's ad: the shop's other products, a few seconds after the
 * room opens and again at most every ten minutes, only between questions: it
 * waits while a question is unanswered or a mock set is running.
 */
export function ClassroomUpsellPopup({ upsell }: { upsell: ClassroomUpsell }) {
  const [open, setOpen] = useState(false);
  const lastShown = useRef(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opened = Date.now();
    const timer = window.setInterval(() => {
      const since = Date.now() - (lastShown.current || opened);
      if (since < (lastShown.current ? UPSELL_AGAIN_MS : UPSELL_FIRST_MS) || busy()) return;
      lastShown.current = Date.now();
      setOpen(true);
    }, UPSELL_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="upsell-title" className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-container bg-paper p-5 shadow-lift-4">
      <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="ปิดโฆษณา" className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-paper-dim text-ink transition hover:bg-line">
        <CloseIcon className="size-4" />
      </button>
      <p className="text-[11px] font-semibold tracking-[0.18em] text-muted">แนะนำจาก {upsell.shopName}</p>
      <h2 id="upsell-title" className="mt-1 pr-10 text-lg font-bold text-ink">{upsell.upgrade ? "ฝึกต่อให้ครบด้วยตัวเต็ม" : "คอร์สอื่นในร้าน"}</h2>
      <ul className="mt-4 space-y-3">
        {upsell.items.map(item => <li key={item.id}>
          <Link href={item.href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-xl border p-2.5 transition hover:border-ink ${item.id === upsell.upgrade?.id ? "border-accent bg-accent/5" : "border-line"}`}>
            {item.cover
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={item.cover} alt="" loading="lazy" className="h-20 w-16 shrink-0 rounded-md bg-paper-dim object-cover" />
              : <span className="h-20 w-16 shrink-0 rounded-md bg-paper-dim" />}
            <span className="min-w-0 flex-1">
              {item.id === upsell.upgrade?.id && <span className="mb-1 inline-block rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-paper">ตัวเต็ม</span>}
              <span className="line-clamp-2 block text-sm font-semibold leading-5 text-ink">{item.name}</span>
              <span className="mt-1 flex items-baseline gap-1.5">
                <span className="font-bold text-[#d2262f]" data-numeric>{formatTHB(item.priceCents)}</span>
                {item.compareCents && item.compareCents > item.priceCents && <s className="text-xs text-muted" data-numeric>{formatTHB(item.compareCents)}</s>}
              </span>
            </span>
          </Link>
        </li>)}
      </ul>
    </section>
  </div>;
}
