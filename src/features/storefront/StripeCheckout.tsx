"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { trackStorefrontEvent } from "@/features/analytics/tracking";
import { formatTHB } from "@/features/products/format";
import { safeAuthRedirect } from "@/lib/auth";
import { GoogleLoginDialog } from "@/features/storefront/GoogleLoginDialog";

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
  const [showStickyPurchase, setShowStickyPurchase] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const soldOut = product.deliveryType === "key" && (product.availableStock ?? 0) <= 0;

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyPurchase(!entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(trigger);
    return () => observer.disconnect();
  }, []);

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
        body: JSON.stringify({ kind: "product", productId: product.id, requestId: requestId.current }),
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
      <button
        ref={triggerRef}
        type="button"
        onClick={startCheckout}
        disabled={starting || soldOut}
        className="w-full rounded-2xl bg-accent px-6 py-4 text-base font-bold text-paper shadow-[0_10px_25px_color-mix(in_srgb,var(--accent)_22%,transparent)] transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {soldOut ? "สินค้าหมด" : starting ? "กำลังเปิด QR PromptPay..." : `ซื้อเลย ${formatTHB(product.priceCents)}`}
      </button>
      {error && <p role="alert" className="mt-3 text-center text-sm text-red-600">{error}</p>}
      {loginReturnTo && <GoogleLoginDialog next={loginReturnTo} onClose={closeLogin} returnFocus={purchaseTrigger} />}

      {showStickyPurchase && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-4 py-3 shadow-[0_-10px_30px_rgba(24,24,27,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink">{product.name}</p>
              <p className="mt-0.5 text-sm font-bold text-ink">{formatTHB(product.priceCents)}</p>
            </div>
            <button type="button" onClick={startCheckout} disabled={starting || soldOut} className="shrink-0 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-paper hover:bg-accent-hover disabled:opacity-60">
              {soldOut ? "สินค้าหมด" : starting ? "กำลังเปิด..." : "ซื้อเลย"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
