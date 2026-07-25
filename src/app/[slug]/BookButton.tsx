"use client";

import { useEffect, useRef, useState } from "react";
import { formatTHB } from "@/features/products/format";
import { createPublicClient } from "@/lib/supabase/public";

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

export type BookingResult = {
  calendarSynced: boolean;
  meetUrl: string | null;
};

type Props = {
  serviceId: string;
  shopId: string;
  serviceName: string;
  priceCents: number;
  durationMinutes: number;
  availability?: Availability | null;
  createBooking?: (value: BookingValue) => Promise<BookingResult | void>;
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
  createBooking,
}: Props) {
  const [open, setOpen] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [when, setWhen] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
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

  async function defaultCreateBooking(value: BookingValue) {
    const supabase = createPublicClient();
    const bookingId = crypto.randomUUID();
    const { error } = await supabase.from("bookings").insert({
      id: bookingId,
      shop_id: shopId,
      service_id: serviceId,
      buyer_name: value.buyerName,
      buyer_email: value.buyerEmail,
      scheduled_at: value.scheduledAt,
      price_cents: priceCents,
      status: "confirmed",
    });
    if (error) throw new Error(error.message);

    const { data, error: syncError } = await supabase.functions.invoke(
      "sync-booking-calendar",
      { body: { bookingId } },
    );

    if (syncError || !data?.calendarSynced) {
      return { calendarSynced: false, meetUrl: null };
    }

    return {
      calendarSynced: true,
      meetUrl: typeof data.meetUrl === "string" ? data.meetUrl : null,
    };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === "loading") return;
    const { valid, name, email } = validate();
    if (!valid) return;
    setState("loading");
    setSubmitError(null);
    try {
      const result = await (createBooking ?? defaultCreateBooking)({
        buyerName: name,
        buyerEmail: email,
        scheduledAt: new Date(when).toISOString(),
      });
      setBookingResult(result ?? { calendarSynced: false, meetUrl: null });
      setState("done");
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
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-paper p-6 shadow-2xl sm:max-w-md sm:rounded-3xl"
          >
            {state === "done" ? (
              <div className="py-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-700">✓</div>
                <h2 id={`booking-title-${serviceId}`} className="mt-5 text-xl font-bold text-ink">ยืนยันการจองแล้ว</h2>
                <p className="mt-2 text-sm leading-6 text-muted">รายการทดลองถูกส่งเข้าหน้าการจองของร้านเรียบร้อย</p>
                {bookingResult?.calendarSynced && (
                  <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3">
                    <p className="text-sm font-semibold text-emerald-800">
                      เพิ่มนัดลง Google Calendar แล้ว
                    </p>
                    {bookingResult.meetUrl && (
                      <a
                        href={bookingResult.meetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-sm font-semibold text-emerald-800 underline underline-offset-4"
                      >
                        เปิด Google Meet
                      </a>
                    )}
                  </div>
                )}
                <button type="button" onClick={close} className="primary-button mt-6">กลับไปหน้าร้าน</button>
              </div>
            ) : (
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
                <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs font-semibold text-amber-900">ระบบชำระเงินเป็น mockup — ไม่มีการตัดเงินจริง</p>
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
                    {state === "loading" ? "กำลังยืนยันการจอง..." : `ยืนยันการจอง ${formatTHB(priceCents)}`}
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
