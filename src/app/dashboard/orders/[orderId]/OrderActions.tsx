"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CheckIcon } from "@/components/icons";

export function OrderActions({
  orderId,
  assignedKey,
  emailStatus,
  canRetryEmail = false,
  sendEmail,
}: {
  orderId: string;
  assignedKey?: string | null;
  emailStatus?: "pending" | "sent" | "failed" | null;
  canRetryEmail?: boolean;
  sendEmail?: (orderId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  async function retryEmail() {
    if (!canRetryEmail || emailBusy) return;
    setEmailBusy(true);
    setError(null);
    setEmailMessage(null);
    try {
      if (sendEmail) {
        await sendEmail(orderId);
      } else {
        const supabase = createClient();
        const { error: invokeError } = await supabase.functions.invoke(
          "send-product-key",
          { body: { orderId } },
        );
        if (invokeError) throw invokeError;
      }
      setEmailMessage("ส่งอีเมลเรียบร้อยแล้ว");
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

  return (
    <div className="space-y-4">
      {(assignedKey || emailStatus) && (
        <section className="rounded-2xl border border-line p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">{assignedKey ? "Product Key ที่ส่งมอบ" : "อีเมลคำสั่งซื้อ"}</h2>
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
          {assignedKey && <code className="mt-4 block break-all rounded-xl bg-paper-dim px-4 py-3 text-sm font-bold text-ink">
            {assignedKey}
          </code>}
          <div className="mt-3 flex flex-wrap gap-2">
            {assignedKey && <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(assignedKey);
                setCopied(true);
              }}
              className="secondary-button"
            >
              {copied ? <span className="inline-flex items-center gap-1.5"><CheckIcon className="size-3.5" />คัดลอกแล้ว</span> : "คัดลอก Key"}
            </button>}
            {emailStatus !== "sent" && canRetryEmail && (
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
      {emailMessage && <p role="status" className="text-xs text-emerald-700">{emailMessage}</p>}
      {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  );
}
