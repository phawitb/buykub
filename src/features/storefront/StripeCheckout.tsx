"use client";

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { trackStorefrontEvent } from "@/features/analytics/tracking";
import { formatTHB } from "@/features/products/format";
import { safeAuthRedirect } from "@/lib/auth";
import { GoogleLoginDialog } from "@/features/storefront/GoogleLoginDialog";
import { normalizePromoCode, type PromoQuote } from "@/lib/promo/codes";

type Product = {
  id: string;
  shopId: string;
  name: string;
  priceCents: number;
  deliveryType: "file" | "key" | "course";
  courseAccessDays?: number | null;
  availableStock?: number;
};

export function StripeCheckout({
  product,
  redirectToCheckout = (url: string) => window.location.assign(url),
}: {
  product: Product;
  redirectToCheckout?: (url: string) => void;
}) {
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginReturnTo, setLoginReturnTo] = useState<string | null>(null);
  const purchaseTrigger = useRef<HTMLButtonElement | null>(null);
  const soldOut = product.deliveryType === "key" && (product.availableStock ?? 0) <= 0;
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<PromoQuote | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [checkingPromo, setCheckingPromo] = useState(false);
  const priceCents = promo?.finalCents ?? product.priceCents;

  async function applyPromo(raw: string) {
    const code = normalizePromoCode(raw);
    if (!code) { setPromoError("รูปแบบโค้ดไม่ถูกต้อง"); return; }
    setCheckingPromo(true);
    setPromoError(null);
    try {
      const response = await fetch("/api/promo/quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, code }),
      });
      const payload = (await response.json()) as Partial<PromoQuote> & { error?: string };
      if (!response.ok || typeof payload.finalCents !== "number") throw new Error(payload.error || "ตรวจสอบโค้ดไม่สำเร็จ");
      setPromo(payload as PromoQuote);
      // A new price needs a new checkout; never reuse one made at the old price.
      requestId.current = null;
    } catch (reason) {
      setPromoError(reason instanceof Error ? reason.message : "ตรวจสอบโค้ดไม่สำเร็จ");
    } finally {
      setCheckingPromo(false);
    }
  }

  function removePromo() {
    setPromo(null);
    setPromoInput("");
    setPromoError(null);
    requestId.current = null;
  }

  // A shared link like ?code=SAVE20 fills in and checks the code.
  useEffect(() => {
    const code = normalizePromoCode(new URLSearchParams(window.location.search).get("code"));
    if (!code) return;
    // After hydration, so the server and first client render match.
    const timer = window.setTimeout(() => {
      setPromoOpen(true);
      setPromoInput(code);
      void applyPromo(code);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  function submitPromo(event: FormEvent) {
    event.preventDefault();
    if (!checkingPromo) void applyPromo(promoInput);
  }

  function closeLogin() {
    setLoginReturnTo(null);
    setStarting(false);
    inFlight.current = false;
  }

  async function startCheckout(event: MouseEvent<HTMLButtonElement>) {
    if (inFlight.current || starting || soldOut) return;
    purchaseTrigger.current = event.currentTarget;
    inFlight.current = true;
    requestId.current ??= crypto.randomUUID();
    setStarting(true);
    setError(null);
    void trackStorefrontEvent({
      event: "click_buy",
      productId: product.id,
      shopId: product.shopId,
    }).catch(() => undefined);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        signal: AbortSignal.timeout(45000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "product", productId: product.id, requestId: requestId.current, ...(promo ? { promoCode: promo.code } : {}) }),
      });
      const payload = (await response.json()) as { url?: string; error?: string; code?: string };
      if (payload.code === "google_login_required") {
        const returnTo = safeAuthRedirect(`${window.location.pathname}${window.location.search}`);
        setStarting(false);
        inFlight.current = false;
        setLoginReturnTo(returnTo);
        return;
      }
      if (payload.code === "checkout_expired") requestId.current = null;
      if (payload.code === "promo_rejected") { requestId.current = null; setPromo(null); setPromoOpen(true); setPromoError(payload.error ?? null); setStarting(false); inFlight.current = false; return; }
      if (!response.ok || !payload.url) throw new Error(payload.error || "เปิดหน้าชำระเงินไม่สำเร็จ");
      void trackStorefrontEvent({
        event: "open_checkout",
        productId: product.id,
        shopId: product.shopId,
      }).catch(() => undefined);
      redirectToCheckout(payload.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "เปิดหน้าชำระเงินไม่สำเร็จ");
      setStarting(false);
      inFlight.current = false;
    }
  }

  return (
    <>
      {product.deliveryType === "key" && (
        <p className={`mb-3 text-center text-sm font-semibold ${soldOut ? "text-red-600" : (product.availableStock ?? 0) <= 5 ? "text-amber-700" : "text-emerald-700"}`}>
          {soldOut ? "สินค้าหมด" : `เหลือ ${product.availableStock} รายการ`}
        </p>
      )}
      {!soldOut && product.priceCents > 0 && (promo ? (
        <p className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span className="min-w-0 truncate">โค้ด <strong className="font-semibold">{promo.code}</strong> ลด {formatTHB(promo.discountCents)}</span>
          <button type="button" onClick={removePromo} disabled={starting} className="shrink-0 text-xs font-medium text-emerald-800 underline underline-offset-2">ยกเลิกโค้ด</button>
        </p>
      ) : promoOpen ? (
        <form onSubmit={submitPromo} className="mb-2">
          <div className="flex gap-2">
            <label htmlFor={`promo-${product.id}`} className="sr-only">โค้ดส่วนลด</label>
            <input id={`promo-${product.id}`} value={promoInput} onChange={(event) => setPromoInput(event.target.value.toUpperCase())} maxLength={30} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="กรอกโค้ดส่วนลด" className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3.5 text-sm uppercase text-ink outline-none placeholder:normal-case focus:border-ink" />
            <button type="submit" disabled={checkingPromo || !promoInput.trim()} className="h-11 shrink-0 rounded-xl border border-ink px-4 text-sm font-semibold text-ink transition hover:bg-paper-dim disabled:opacity-50">{checkingPromo ? "กำลังตรวจ..." : "ใช้โค้ด"}</button>
          </div>
          {promoError && <p role="alert" className="mt-1.5 text-xs text-red-600">{promoError}</p>}
        </form>
      ) : (
        <button type="button" onClick={() => setPromoOpen(true)} className="mb-2 block w-full text-center text-xs font-medium text-muted underline underline-offset-2 hover:text-ink">มีโค้ดส่วนลด?</button>
      ))}
      <button
        type="button"
        onClick={startCheckout}
        disabled={starting || soldOut}
        className="w-full rounded-2xl bg-accent px-6 py-3.5 text-base font-bold text-paper shadow-[0_10px_25px_color-mix(in_srgb,var(--accent)_22%,transparent)] transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {soldOut ? "สินค้าหมด" : product.priceCents === 0 ? (starting ? "กำลังเปิด..." : "รับฟรี") : starting ? "กำลังเปิด QR PromptPay..." : <>ซื้อเลย {formatTHB(priceCents)}{promo && <s className="ml-2 text-sm font-medium opacity-70">{formatTHB(promo.listCents)}</s>}</>}
      </button>
      {error && <p role="alert" className="mt-3 text-center text-sm text-red-600">{error}</p>}
      {loginReturnTo && <GoogleLoginDialog next={loginReturnTo} onClose={closeLogin} returnFocus={purchaseTrigger} />}
    </>
  );
}
