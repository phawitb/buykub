"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function OrderActions({
  orderId,
  status,
  updateStatus,
  assignedKey,
  emailStatus,
  emailToken,
  sendEmail,
}: {
  orderId: string;
  status: "paid" | "refunded";
  updateStatus?: (status: "paid" | "refunded") => Promise<void>;
  assignedKey?: string | null;
  emailStatus?: "pending" | "sent" | "failed" | null;
  emailToken?: string | null;
  sendEmail?: (orderId: string, emailToken: string) => Promise<void>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  async function retryEmail() {
    if (!emailToken || emailBusy) return;
    setEmailBusy(true);
    setError(null);
    setEmailMessage(null);
    try {
      if (sendEmail) {
        await sendEmail(orderId, emailToken);
      } else {
        const supabase = createClient();
        const { error: invokeError } = await supabase.functions.invoke(
          "send-product-key",
          { body: { orderId, emailToken } },
        );
        if (invokeError) throw invokeError;
      }
      setEmailMessage("ส่ง Product Key ทางอีเมลเรียบร้อยแล้ว");
      router.refresh();
    } catch (sendError) {
      setError(
        `ส่งอีเมลไม่สำเร็จ: ${
          sendError instanceof Error ? sendError.message : "กรุณาลองอีกครั้ง"
        }`,
      );
    } finally {
      setEmailBusy(false);
    }
  }

  async function toggle() {
    const next = status === "paid" ? "refunded" : "paid";
    if (
      next === "refunded" &&
      !window.confirm("ยืนยันการคืนเงินแบบ mock สำหรับออเดอร์นี้?")
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (updateStatus) {
        await updateStatus(next);
      } else {
        const supabase = createClient();
        const { error: updateError } = await supabase
          .from("orders")
          .update({ status: next })
          .eq("id", orderId);
        if (updateError) throw updateError;
      }
      router.refresh();
    } catch (updateError) {
      setError(
        `อัปเดตออเดอร์ไม่สำเร็จ: ${
          updateError instanceof Error ? updateError.message : "กรุณาลองอีกครั้ง"
        }`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {assignedKey && (
        <section className="rounded-2xl border border-line p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Product Key ที่ส่งมอบ</h2>
              <p className="mt-1 text-xs text-muted">
                {emailStatus === "sent"
                  ? "ส่งอีเมลแล้ว"
                  : emailStatus === "failed"
                    ? "ส่งอีเมลไม่สำเร็จ"
                    : "รอส่งอีเมล"}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                emailStatus === "sent"
                  ? "bg-emerald-50 text-emerald-700"
                  : emailStatus === "failed"
                    ? "bg-red-50 text-red-700"
                    : "bg-amber-50 text-amber-700"
              }`}
            >
              {emailStatus === "sent"
                ? "ส่งแล้ว"
                : emailStatus === "failed"
                  ? "ส่งไม่สำเร็จ"
                  : "กำลังส่ง"}
            </span>
          </div>
          <code className="mt-4 block break-all rounded-xl bg-paper-dim px-4 py-3 text-sm font-bold text-ink">
            {assignedKey}
          </code>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(assignedKey);
                setCopied(true);
              }}
              className="secondary-button"
            >
              {copied ? "คัดลอกแล้ว ✓" : "คัดลอก Key"}
            </button>
            {emailStatus !== "sent" && emailToken && (
              <button
                type="button"
                disabled={emailBusy}
                onClick={() => void retryEmail()}
                className="primary-button"
              >
                {emailBusy ? "กำลังส่ง..." : "ส่งอีเมลอีกครั้ง"}
              </button>
            )}
          </div>
        </section>
      )}
      <button
          type="button"
          disabled={busy}
          onClick={toggle}
          className={status === "paid" ? "secondary-button" : "primary-button"}
        >
          {busy
            ? "กำลังอัปเดต..."
            : status === "paid"
              ? "คืนเงิน (Mock)"
              : "คืนสถานะเป็นชำระแล้ว"}
        </button>
      {emailMessage && <p role="status" className="text-xs text-emerald-700">{emailMessage}</p>}
      {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  );
}
