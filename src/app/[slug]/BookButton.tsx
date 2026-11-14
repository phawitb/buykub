"use client";

import { useEffect, useRef, useState } from "react";
import { formatTHB } from "@/features/products/format";

type Availability = {
  days?: number[];
  start?: string;
  end?: string;
  advance_days?: number;
};

export type BookingValue = {
  buyerName: string;
  buyerEmail: string;
  scheduledAt: string;
};

export type BookingCheckout = { url: string };

type Props = {
  serviceId: string;
  shopId: string;
  serviceName: string;
  priceCents: number;
  durationMinutes: number;
  availability?: Availability | null;
  startCheckout?: (value: BookingValue) => Promise<BookingCheckout>;
};

function localInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function BookButton({
  serviceId,
  shopId,
  serviceName,
  priceCents,
  durationMinutes,
  availability,
  startCheckout,
}: Props) {
  const [open, setOpen] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [when, setWhen] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading">("idle");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const minimumDate = localInputValue(new Date());
  const maximumDate = localInputValue(
    new Date(Date.now() + (availability?.advance_days ?? 30) * 86_400_000),
  );

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

  function trapFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>("button, input"),
    ).filter((element) => !element.hasAttribute("disabled"));
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

  function validate() {
    const nextErrors: Record<string, string> = {};
    const name = buyerName.trim();
    const email = buyerEmail.trim().toLowerCase();
    const selected = when ? new Date(when) : null;
    if (!name) nextErrors.name = "กรุณากรอกชื่อผู้จอง";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "กรุณากรอกอีเมลให้ถูกต้อง";
    }
    if (!selected || Number.isNaN(selected.getTime()) || selected <= new Date()) {
      nextErrors.when = "กรุณาเลือกวันและเวลาในอนาคต";
    } else if (selected > new Date(maximumDate)) {
      nextErrors.when = `จองล่วงหน้าได้ไม่เกิน ${availability?.advance_days ?? 30} วัน`;
    } else {
      const allowedDays = availability?.days ?? [1, 2, 3, 4, 5];
      const time = selected.toTimeString().slice(0, 5);
      if (!allowedDays.includes(selected.getDay())) {
        nextErrors.when = "วันดังกล่าวไม่อยู่ในวันที่ร้านเปิดรับจอง";
      } else if (
        time < (availability?.start ?? "09:00") ||
        time >= (availability?.end ?? "18:00")
      ) {
        nextErrors.when = `กรุณาเลือกเวลาระหว่าง ${availability?.start ?? "09:00"}–${availability?.end ?? "18:00"}`;
      }
    }
    setErrors(nextErrors);
    return { valid: Object.keys(nextErrors).length === 0, name, email };
  }

  async function defaultStartCheckout(value: BookingValue): Promise<BookingCheckout> {
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "service",
        serviceId,
        buyerName: value.buyerName,
        buyerEmail: value.buyerEmail,
        scheduledAt: value.scheduledAt,
      }),
    });
    const payload = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      throw new Error(payload.error || "เปิดหน้าชำระเงินไม่สำเร็จ");
    }
    return { url: payload.url };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === "loading") return;
    const { valid, name, email } = validate();
    if (!valid) return;
    setState("loading");
    setSubmitError(null);
    try {
      const result = await (startCheckout ?? defaultStartCheckout)({
        buyerName: name,
        buyerEmail: email,
        scheduledAt: new Date(when).toISOString(),
      });
      window.location.assign(result.url);
    } catch (error) {
      setSubmitError(
        `จองบริการไม่สำเร็จ: ${error instanceof Error ? error.message : "กรุณาลองอีกครั้ง"}`,
      );
      setState("idle");
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-paper transition hover:bg-accent-hover"
      >
        จองบริการ
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`booking-title-${serviceId}`}
            onKeyDown={trapFocus}
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-paper p-6 shadow-lift-4 sm:max-w-md sm:rounded-3xl"
          >
            <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-accent">BOOKING</p>
                    <h2 id={`booking-title-${serviceId}`} className="mt-1 text-xl font-bold text-ink">จองบริการ</h2>
                  </div>
                  <button type="button" onClick={close} aria-label="ปิดหน้าจองบริการ" className="icon-button">×</button>
                </div>
                <div className="mt-5 rounded-2xl bg-paper-dim p-4">
                  <p className="font-semibold text-ink">{serviceName}</p>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-muted">{durationMinutes} นาที</span>
                    <span className="font-bold text-ink">{formatTHB(priceCents)}</span>
                  </div>
                </div>
                <p className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-center text-xs font-semibold text-sky-900">ชำระเงินอย่างปลอดภัยผ่าน Stripe</p>
                <form onSubmit={submit} noValidate className="mt-5 space-y-4">
                  <label className="field-label">ชื่อผู้จอง
                    <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className="field-input mt-2" autoComplete="name" />
                    {errors.name && <span className="field-error">{errors.name}</span>}
                  </label>
                  <label className="field-label">อีเมล
                    <input value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} className="field-input mt-2" type="email" autoComplete="email" />
                    {errors.email && <span className="field-error">{errors.email}</span>}
                  </label>
                  <label className="field-label">วันและเวลา
                    <input aria-label="วันและเวลา" type="datetime-local" value={when} min={minimumDate} max={maximumDate} step={1800} onChange={(e) => setWhen(e.target.value)} className="field-input mt-2" />
                    <span className="mt-1 block text-xs font-normal text-muted">
                      เปิดรับ {availability?.start ?? "09:00"}–{availability?.end ?? "18:00"} · จองล่วงหน้าได้ {availability?.advance_days ?? 30} วัน
                    </span>
                    {errors.when && <span className="field-error">{errors.when}</span>}
                  </label>
                  {submitError && <p role="alert" className="text-sm text-red-600">{submitError}</p>}
                  <button type="submit" disabled={state === "loading"} className="primary-button w-full">
                    {state === "loading" ? "กำลังเปิดหน้า Stripe..." : `ไปชำระเงิน ${formatTHB(priceCents)}`}
                  </button>
                </form>
              </>
          </div>
        </div>
      )}
    </>
  );
}
