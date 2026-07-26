"use client";

import { useEffect, useRef, useState } from "react";
import {
  trackStorefrontEvent,
  type StorefrontEventType,
} from "@/features/analytics/tracking";
import { formatTHB } from "@/features/products/format";
import { createPublicClient } from "@/lib/supabase/public";

export type MockCheckoutValue = {
  buyerName: string;
  buyerEmail: string;
  paymentMethod: "promptpay" | "card";
};

type Product = {
  id: string;
  shopId: string;
  name: string;
  priceCents: number;
  deliveryType?: "file" | "key";
  availableStock?: number;
};

export type CheckoutResult = {
  orderId: string;
  deliveryType: "file" | "key";
  assignedKey?: string;
  emailStatus?: "sent" | "failed" | "pending";
  remainingStock?: number;
};

type Props = {
  product: Product;
  createOrder?: (value: MockCheckoutValue) => Promise<CheckoutResult | void>;
  trackEvent?: (event: StorefrontEventType) => Promise<void>;
};

export function MockCheckout({ product, createOrder, trackEvent }: Props) {
  const [open, setOpen] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<MockCheckoutValue["paymentMethod"]>("card");
  const [errors, setErrors] = useState<{ email?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [showStickyPurchase, setShowStickyPurchase] = useState(false);
  const [availableStock, setAvailableStock] = useState(
    product.availableStock ?? 0,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", closeOnEscape);
    dialogRef.current?.querySelector<HTMLElement>("input")?.focus();
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

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

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function trapFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        "button, input, a[href], [tabindex]",
      ),
    ).filter(
      (element) =>
        !element.hasAttribute("disabled") &&
        element.getAttribute("tabindex") !== "-1",
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  async function defaultCreateOrder(
    value: MockCheckoutValue,
  ): Promise<CheckoutResult> {
    const supabase = createPublicClient();
    if (product.deliveryType === "key") {
      const { data, error } = await supabase.rpc(
        "complete_mock_key_purchase",
        {
          p_product_id: product.id,
          p_buyer_email: value.buyerEmail,
          p_payment_method: value.paymentMethod,
        },
      );
      if (error) {
        if (error.message.includes("sold_out")) {
          throw new Error("สินค้าหมดแล้ว กรุณารีเฟรชหน้า");
        }
        throw new Error(error.message);
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.assigned_key) throw new Error("ไม่ได้รับ Product Key");
      let emailStatus: CheckoutResult["emailStatus"] = "sent";
      const { error: emailError } = await supabase.functions.invoke(
        "send-product-key",
        {
          body: {
            orderId: row.order_id,
            emailToken: row.email_token,
          },
        },
      );
      if (emailError) emailStatus = "failed";
      return {
        orderId: row.order_id,
        deliveryType: "key",
        assignedKey: row.assigned_key,
        remainingStock: row.remaining_stock,
        emailStatus,
      };
    }
    const { error } = await supabase.from("orders").insert({
      shop_id: product.shopId,
      product_id: product.id,
      buyer_name: value.buyerName,
      buyer_email: value.buyerEmail,
      payment_method: value.paymentMethod,
      price_cents: product.priceCents,
      status: "paid",
      mock: true,
    });
    if (error) throw new Error(error.message);
    return { orderId: "", deliveryType: "file" };
  }

  function recordEvent(event: StorefrontEventType) {
    const operation = trackEvent
      ? trackEvent(event)
      : trackStorefrontEvent({
          event,
          productId: product.id,
          shopId: product.shopId,
        });
    void operation.catch(() => undefined);
  }

  function openCheckout() {
    if (product.deliveryType === "key" && availableStock <= 0) {
      return;
    }
    recordEvent("click_buy");
    setOpen(true);
    recordEvent("open_checkout");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const email = buyerEmail.trim().toLowerCase();
    const nextErrors: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "กรุณากรอกอีเมลให้ถูกต้อง";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const checkoutResult = await (createOrder ?? defaultCreateOrder)({
        buyerName: "",
        buyerEmail: email,
        paymentMethod,
      });
      if (checkoutResult) setResult(checkoutResult);
      if (
        checkoutResult?.deliveryType === "key" &&
        checkoutResult.remainingStock !== undefined
      ) {
        setAvailableStock(checkoutResult.remainingStock);
      }
      recordEvent("purchase");
      setDone(true);
    } catch (error) {
      setSubmitError(
        `สร้างคำสั่งซื้อทดลองไม่สำเร็จ: ${
          error instanceof Error ? error.message : "กรุณาลองอีกครั้ง"
        }`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {product.deliveryType === "key" && (
        <p
          className={`mb-3 text-center text-sm font-semibold ${
            availableStock > 0
              ? availableStock <= 5
                ? "text-amber-700"
                : "text-emerald-700"
              : "text-red-600"
          }`}
        >
          {availableStock > 0
            ? `เหลือ ${availableStock} รายการ`
            : "สินค้าหมด"}
        </p>
      )}
      <button
        ref={triggerRef}
        type="button"
        onClick={openCheckout}
        disabled={
          product.deliveryType === "key" && availableStock <= 0
        }
        className="w-full rounded-2xl bg-accent px-6 py-4 text-base font-bold text-paper shadow-[0_10px_25px_color-mix(in_srgb,var(--accent)_22%,transparent)] transition hover:bg-accent-hover"
      >
        {product.deliveryType === "key" && availableStock <= 0
          ? "สินค้าหมด"
          : `ซื้อเลย ${formatTHB(product.priceCents)}`}
      </button>

      {showStickyPurchase && !open && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-4 py-3 shadow-[0_-10px_30px_rgba(24,24,27,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink">{product.name}</p>
              <p className="mt-0.5 text-sm font-bold text-ink">
                {formatTHB(product.priceCents)}
              </p>
            </div>
            <button
              type="button"
              onClick={openCheckout}
              disabled={
                product.deliveryType === "key" &&
                availableStock <= 0
              }
              className="shrink-0 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-paper hover:bg-accent-hover"
            >
              {product.deliveryType === "key" &&
              availableStock <= 0
                ? "สินค้าหมด"
                : "ซื้อเลย"}
            </button>
          </div>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
            onKeyDown={trapFocus}
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-paper p-6 shadow-2xl sm:max-w-md sm:rounded-3xl"
          >
            {done ? (
              <div className="py-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-700">
                  ✓
                </div>
                <h2 id="checkout-title" className="mt-5 text-xl font-bold text-ink">
                  สร้างคำสั่งซื้อทดลองแล้ว
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  ไม่มีการตัดเงินจริง
                </p>
                {result?.deliveryType === "key" && result.assignedKey && (
                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left">
                    <p className="text-xs font-semibold text-emerald-800">
                      PRODUCT KEY ของคุณ
                    </p>
                    <code className="mt-2 block break-all rounded-xl bg-paper px-3 py-3 text-sm font-bold text-ink">
                      {result.assignedKey}
                    </code>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(result.assignedKey!);
                        setCopied(true);
                      }}
                      className="secondary-button mt-3 w-full"
                    >
                      {copied ? "คัดลอกแล้ว ✓" : "คัดลอก Key"}
                    </button>
                    <p className="mt-3 text-xs leading-5 text-emerald-900">
                      {result.emailStatus === "sent"
                        ? "ส่ง Key ไปยังอีเมลแล้ว"
                        : result.emailStatus === "failed"
                          ? "ส่งอีเมลไม่สำเร็จ กรุณาคัดลอก Key เก็บไว้"
                          : "กำลังส่ง Key ไปยังอีเมล"}
                    </p>
                  </div>
                )}
                <button type="button" onClick={close} className="primary-button mt-6">
                  กลับไปดูสินค้า
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-accent">
                      CHECKOUT MOCKUP
                    </p>
                    <h2 id="checkout-title" className="mt-1 text-xl font-bold text-ink">
                      ชำระเงิน
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="ปิดหน้าชำระเงิน"
                    className="icon-button"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-5 rounded-2xl bg-paper-dim p-4">
                  <p className="line-clamp-2 text-sm font-semibold text-ink">
                    {product.name}
                  </p>
                  <p className="mt-2 font-bold text-ink">
                    {formatTHB(product.priceCents)}
                  </p>
                </div>

                <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs font-semibold text-amber-900">
                  ทดลองเท่านั้น — ไม่มีการตัดเงินจริง
                </p>

                <form
                  onSubmit={submit}
                  noValidate
                  className="mt-5 space-y-4"
                >
                  <label className="field-label">
                    อีเมล
                    <input
                      value={buyerEmail}
                      onChange={(event) => setBuyerEmail(event.target.value)}
                      className="field-input mt-2"
                      type="email"
                      autoComplete="email"
                    />
                    {errors.email && (
                      <span className="field-error">{errors.email}</span>
                    )}
                  </label>

                  <fieldset>
                    <legend className="field-label">ช่องทางชำระเงินจำลอง</legend>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label
                        className={`checkout-option ${
                          paymentMethod === "card"
                            ? "checkout-option-active"
                            : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment-method"
                          value="card"
                          aria-label="บัตรเครดิต"
                          checked={paymentMethod === "card"}
                          onChange={() => setPaymentMethod("card")}
                          className="sr-only"
                        />
                        บัตรเครดิต
                      </label>
                      <label
                        className={`checkout-option ${
                          paymentMethod === "promptpay"
                            ? "checkout-option-active"
                            : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment-method"
                          value="promptpay"
                          checked={paymentMethod === "promptpay"}
                          onChange={() => setPaymentMethod("promptpay")}
                          className="sr-only"
                        />
                        PromptPay
                      </label>
                    </div>
                  </fieldset>

                  {submitError && (
                    <p className="text-sm text-red-600" role="alert">
                      {submitError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="primary-button w-full"
                  >
                    {submitting
                      ? "กำลังประมวลผล..."
                      : "ชำระเงิน (ทดลอง)"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
