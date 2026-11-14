"use client";

import { useEffect, useState } from "react";
import { CheckIcon } from "@/components/icons";

type CheckoutStatus = {
  kind: "product" | "service";
  status: "created" | "completed" | "cancelled" | "refunded";
  item_name: string;
  order_id: string | null;
  assigned_key: string | null;
  email_status: "pending" | "sent" | "failed" | null;
  booking_id: string | null;
  booking_status: "pending" | "confirmed" | "cancelled" | "failed" | null;
  meet_url: string | null;
  delivery_type?: "file" | "key" | "course";
  product_id?: string;
  course_expires_at?: string | null;
};

export function CheckoutSuccess({ sessionId }: { sessionId: string }) {
  const [result, setResult] = useState<CheckoutStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const response = await fetch(`/api/stripe/checkout-status?session_id=${encodeURIComponent(sessionId)}`);
        const payload = (await response.json()) as CheckoutStatus & { error?: string };
        if (!response.ok) throw new Error(payload.error || "ไม่พบข้อมูลการชำระเงิน");
        if (!active) return;
        setResult(payload);
        setError(null);
        if (payload.status === "created") timer = setTimeout(load, 1800);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "ตรวจสอบสถานะไม่สำเร็จ");
      }
    }
    void load();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  if (error) return <p className="mt-4 text-sm text-red-600">{error}</p>;
  if (!result || result.status === "created") {
    return <><h1 className="text-2xl font-bold text-ink">กำลังตรวจสอบการชำระเงิน</h1><p className="mt-4 text-sm leading-6 text-muted">กำลังรอผลยืนยันจากผู้ให้บริการชำระเงิน กรุณารอสักครู่...</p></>;
  }
  if (result.status === "refunded") {
    return <><h1 className="text-2xl font-bold text-ink">คืนเงินแล้ว</h1><p className="mt-4 text-sm leading-6 text-muted">รายการนี้ได้รับการคืนเงินเต็มจำนวนแล้ว และไม่สามารถเข้าเรียน ดาวน์โหลดสินค้า หรือดู Key ได้</p></>;
  }
  if (result.status === "cancelled") {
    return <p className="mt-4 text-sm text-red-600">รายการนี้ถูกยกเลิกแล้ว</p>;
  }
  if (result.kind === "service") {
    return (
      <>
        <h1 className="text-2xl font-bold text-ink">ชำระเงินสำเร็จ</h1>
        <p className="mt-4 text-sm leading-6 text-muted">ใบเสร็จรายการเดิม “{result.item_name}” ระบบจองบริการพักให้บริการชั่วคราว หากต้องการสอบถามรายการนี้ กรุณาติดต่อร้านค้า</p>
        {result.meet_url && <a href={result.meet_url} target="_blank" rel="noreferrer" className="primary-button mt-6 inline-block">เปิด Google Meet</a>}
      </>
    );
  }
  if (result.delivery_type === "course" && result.product_id) {
    return (
      <>
        <p className="text-xs font-semibold tracking-widest text-accent">BUYKUB CLASSROOM</p>
        <h1 className="mt-3 text-2xl font-bold text-ink">คอร์สของคุณพร้อมเรียนแล้ว</h1>
        <p className="mt-4 text-sm leading-6 text-muted">ชำระเงิน “{result.item_name}” สำเร็จแล้ว เข้าเรียนด้วยบัญชี Google เดียวกับที่ใช้ซื้อคอร์ส</p>
        <a href={`/learn/${encodeURIComponent(result.product_id)}`} className="primary-button mt-6 inline-block">เริ่มเรียนคอร์ส</a>
        <p className="mt-4 text-xs text-muted">{result.course_expires_at ? `เรียนได้ถึง ${new Date(result.course_expires_at).toLocaleDateString("th-TH", {timeZone:"Asia/Bangkok", day:"numeric", month:"long", year:"numeric"})}` : "สิทธิ์เรียนตลอดไป"}</p>
      </>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-bold text-ink">ชำระเงินสำเร็จ</h1>
      <p className="mt-4 text-sm leading-6 text-muted">ชำระเงิน “{result.item_name}” สำเร็จแล้ว</p>
      {!result.assigned_key && (
        <a href={`/api/stripe/download?session_id=${encodeURIComponent(sessionId)}`} rel="noreferrer" className="primary-button mt-6 inline-block">ดาวน์โหลดไฟล์สินค้า</a>
      )}
      {result.assigned_key && (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left">
          <p className="text-xs font-semibold text-emerald-800">PRODUCT KEY ของคุณ</p>
          <code className="mt-2 block break-all rounded-xl bg-paper px-3 py-3 text-sm font-bold text-ink">{result.assigned_key}</code>
          <button type="button" onClick={async () => { await navigator.clipboard.writeText(result.assigned_key!); setCopied(true); }} className="secondary-button mt-3 w-full">
            {copied ? <span className="inline-flex items-center gap-1.5"><CheckIcon className="size-3.5" />คัดลอกแล้ว</span> : "คัดลอก Key"}
          </button>
          <p className="mt-3 text-xs leading-5 text-emerald-900">
            {result.email_status === "sent" ? "ส่ง Key ไปยังอีเมลแล้ว" : result.email_status === "failed" ? "ส่งอีเมลไม่สำเร็จ กรุณาคัดลอก Key เก็บไว้" : "กำลังส่ง Key ไปยังอีเมล"}
          </p>
        </div>
      )}
    </>
  );
}
