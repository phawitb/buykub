"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRightIcon, CloseIcon } from "@/components/icons";
import { formatTHB } from "@/features/products/format";

export type ShopPromoData = {
  slug: string;
  name: string;
  headline: string;
  bio: string | null;
  avatarUrl: string | null;
  covers: string[];
  productCount: number;
  fromCents: number;
  fromCompareCents: number | null;
  maxDiscount: number | null;
};

/** How long a closed ad stays closed for this browser. */
export const PROMO_SNOOZE_MS = 24 * 60 * 60 * 1000;
export const PROMO_DELAY_MS = 1200;

const storageKey = (slug: string) => `bk_promo_closed:${slug}`;

function closedRecently(slug: string) {
  try {
    const at = Number(window.localStorage.getItem(storageKey(slug)));
    return Number.isFinite(at) && at > 0 && Date.now() - at < PROMO_SNOOZE_MS;
  } catch {
    return false;
  }
}

function rememberClosed(slug: string) {
  try {
    window.localStorage.setItem(storageKey(slug), String(Date.now()));
  } catch {
    // Private windows can refuse storage; the ad then simply returns next visit.
  }
}

/**
 * A card that rises into the bottom corner a moment after the home page opens.
 * It does not cover the page or trap focus, so reading can carry on; the close
 * button and Escape put it away for a day.
 */
export function ShopPromoPopup({ promo }: { promo: ShopPromoData }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (closedRecently(promo.slug)) return;
    const timer = window.setTimeout(() => {
      setOpen(true);
      window.requestAnimationFrame(() => setShown(true));
    }, PROMO_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [promo.slug]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function close() {
    rememberClosed(promo.slug);
    setOpen(false);
  }

  if (!open) return null;

  const href = `/${promo.slug}`;

  return (
    <aside
      aria-label={`โฆษณาร้าน ${promo.name}`}
      data-shown={shown || undefined}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm translate-y-6 opacity-0 transition duration-[var(--settle)] ease-[var(--ease-out)] data-[shown]:translate-y-0 data-[shown]:opacity-100 motion-reduce:translate-y-0 motion-reduce:transition-none sm:left-auto sm:right-6 sm:bottom-6 sm:mx-0 sm:w-[23rem]"
    >
      <div className="overflow-hidden rounded-container bg-paper shadow-lift-4 ring-1 ring-black/5">
        <Link
          href={href}
          onClick={() => rememberClosed(promo.slug)}
          tabIndex={-1}
          aria-hidden="true"
          className="relative block h-28 overflow-hidden sm:h-36 bg-[linear-gradient(135deg,#5b2bbf_0%,#8b4fe0_55%,#f0a4c8_100%)]"
        >
          <span className="absolute -left-8 -top-10 size-32 rounded-full bg-white/15" />
          <span className="absolute -bottom-12 right-10 size-28 rounded-full bg-white/10" />
          <span className="absolute left-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-[#4a2399]">
            ร้านแนะนำ
          </span>
          {promo.maxDiscount !== null && (
            <span className="absolute bottom-3 left-3 z-10 rotate-[-6deg] rounded-lg bg-[#ffce2f] px-2.5 py-1 text-sm font-bold text-ink shadow-lift-1">
              ลดสูงสุด {promo.maxDiscount}%
            </span>
          )}
          <span className="absolute -bottom-10 right-12 flex sm:-bottom-6 sm:right-14">
            {promo.covers.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt=""
                loading="lazy"
                style={{ transform: `rotate(${(i - (promo.covers.length - 1) / 2) * 9}deg)`, zIndex: i === 1 ? 2 : 1 }}
                className="-mx-3 h-32 w-24 rounded-md bg-paper object-cover shadow-lift-3 ring-2 ring-white"
              />
            ))}
          </span>
        </Link>

        <button
          type="button"
          onClick={close}
          aria-label="ปิดโฆษณา"
          className="absolute right-2.5 top-2.5 inline-flex size-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <CloseIcon className="size-4" />
        </button>

        <div className="p-4 pt-3 sm:pt-4">
          <div className="flex items-center gap-2">
            {promo.avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={promo.avatarUrl} alt="" className="size-6 rounded-full bg-paper-dim object-cover" />
            )}
            <span className="text-xs font-medium text-muted">
              {promo.name} · {promo.productCount} คอร์ส
            </span>
          </div>
          <p className="mt-2 text-base font-bold leading-6 text-ink">{promo.headline}</p>
          {promo.bio && <p className="mt-1 text-sm leading-5 text-muted">{promo.bio}</p>}

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="flex items-baseline gap-1.5 text-sm">
              <span className="text-muted">เริ่มต้น</span>
              <span className="text-xl font-bold text-[#d2262f]" data-numeric>
                {formatTHB(promo.fromCents)}
              </span>
              {promo.fromCompareCents && promo.fromCompareCents > promo.fromCents && (
                <span className="text-xs text-muted line-through" data-numeric>
                  {formatTHB(promo.fromCompareCents)}
                </span>
              )}
            </p>
            <Link
              href={href}
              onClick={() => rememberClosed(promo.slug)}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#5b2bbf] px-4 text-sm font-semibold text-white transition duration-[120ms] hover:bg-[#4a2399] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b2bbf]"
            >
              ดูคอร์ส
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
