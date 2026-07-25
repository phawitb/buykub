"use client";

import { useEffect, useRef, useState } from "react";
import { formatTHB } from "@/features/products/format";
import { createClient } from "@/lib/supabase/client";

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
};

type Props = {
  product: Product;
  createOrder?: (value: MockCheckoutValue) => Promise<void>;
};

export function MockCheckout({ product, createOrder }: Props) {
  const [open, setOpen] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<MockCheckoutValue["paymentMethod"]>("promptpay");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
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

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  async function defaultCreateOrder(value: MockCheckoutValue) {
    const supabase = createClient();
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
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const name = buyerName.trim();
    const email = buyerEmail.trim().toLowerCase();
    const nextErrors: typeof errors = {};
    if (!name) nextErrors.name = "กรุณากรอกชื่อผู้ซื้อ";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "กรุณากรอกอีเมลให้ถูกต้อง";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await (createOrder ?? defaultCreateOrder)({
        buyerName: name,
        buyerEmail: email,
        paymentMethod,
      });
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
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl bg-accent px-6 py-4 text-base font-bold text-paper shadow-[0_10px_25px_color-mix(in_srgb,var(--accent)_22%,transparent)] transition hover:bg-accent-hover"
      >
        ซื้อเลย {formatTHB(product.priceCents)}
      </button>

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
                  ไม่มีการตัดเงินและไม่มีไฟล์ถูกส่งจริง
                </p>
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
                      ข้อมูลผู้ซื้อ
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
                    ชื่อผู้ซื้อ
                    <input
                      value={buyerName}
                      onChange={(event) => setBuyerName(event.target.value)}
                      className="field-input mt-2"
                      autoComplete="name"
                    />
                    {errors.name && <span className="field-error">{errors.name}</span>}
                  </label>
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
                      ? "กำลังสร้างคำสั่งซื้อ..."
                      : "ยืนยันคำสั่งซื้อทดลอง"}
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
