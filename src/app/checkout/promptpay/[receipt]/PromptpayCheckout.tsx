"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatTHB } from "@/features/products/format";

type Payment = { status: string; receiptUrl?: string; qrUrl?: string; instructionsUrl?: string; expiresAt?: string; name?: string; amountCents?: number; testMode?: boolean };
export function PromptpayCheckout({ receipt }: { receipt: string }) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch(`/api/stripe/promptpay?receipt=${encodeURIComponent(receipt)}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        const result = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(result.error || "ตรวจสอบรายการไม่ได้");
        setPayment(result); setError(null);
        if (result.status === "completed" && result.receiptUrl) { window.location.replace(result.receiptUrl); return; }
        if (result.status === "expired") return;
        attempts += 1;
        if ((result.status === "preparing" && attempts >= 12) || (result.status === "processing" && attempts >= 75) || attempts >= 900) { setError("พักการตรวจสอบอัตโนมัติ กดตรวจสอบอีกครั้งเพื่อดูสถานะล่าสุด"); return; }
        timer = setTimeout(poll, 4000);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง");
      }
    }
    void poll();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [receipt, retry]);
  const expired = payment?.status === "expired";
  return (
    <main className="min-h-screen bg-paper px-4 py-12 text-ink">
      <div className="mx-auto max-w-md rounded-3xl border border-line bg-paper p-6 text-center shadow-lift-1 sm:p-8">
        <p className="text-xs font-bold tracking-[0.2em] text-accent">BUYKUB</p>
        <h1 className="mt-3 text-2xl font-bold">ชำระด้วย QR PromptPay</h1>
        {payment?.name && <p className="mt-3 text-muted">{payment.name}</p>}
        {payment?.amountCents !== undefined && <p className="mt-2 text-3xl font-bold">{formatTHB(payment.amountCents)}</p>}
        {payment?.testMode && <p className="mt-3 rounded-xl bg-amber-50 p-2 text-sm text-amber-800">โหมดทดสอบ — ไม่ใช่การเรียกเก็บเงินจริง</p>}
        {!expired && payment?.qrUrl && <>
          {/* Stripe supplies a single-use QR image; preserve its original pixels. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={payment.qrUrl} alt="QR PromptPay สำหรับรายการนี้" referrerPolicy="no-referrer" className="mx-auto my-6 h-64 w-64 rounded-xl bg-white p-2" />
          <p className="text-sm text-muted">เปิดแอปธนาคาร สแกน QR หรือบันทึกภาพแล้วเลือกจากรูปภาพในแอปธนาคาร</p>
          {payment.instructionsUrl && <a href={payment.instructionsUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-semibold text-accent underline">เปิด QR และคำแนะนำจาก Stripe</a>}
          {payment.expiresAt && <p className="mt-3 text-xs text-muted">รายการนี้ใช้ได้ถึง {new Date(payment.expiresAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</p>}
        </>}
        <p role="status" className="mt-5 text-sm font-medium">{error ? "ยังตรวจสอบสถานะล่าสุดไม่ได้" : expired ? "QR หมดอายุหรือรายการไม่สำเร็จ กรุณากลับไปเริ่มรายการใหม่" : payment?.status === "processing" ? "ได้รับสถานะการชำระเงินแล้ว กำลังรอยืนยันรายการ…" : payment?.qrUrl ? "กำลังรอการชำระเงิน หน้านี้จะเปิดใบเสร็จอัตโนมัติ" : "กำลังโหลด QR…"}</p>
        {error && <div className="mt-4"><p role="alert" className="text-sm text-red-600">{error}</p><button onClick={() => setRetry(value => value + 1)} className="mt-3 rounded-xl bg-accent px-4 py-3 font-semibold text-paper">ตรวจสอบอีกครั้ง</button></div>}
        {payment?.status === "processing" && payment.receiptUrl && <a href={payment.receiptUrl} className="mt-4 inline-block text-accent underline">ดูสถานะใบเสร็จ</a>}
        <Link href="/" className="mt-6 block text-sm text-muted underline">กลับหน้าแรก</Link>
      </div>
    </main>
  );
}
