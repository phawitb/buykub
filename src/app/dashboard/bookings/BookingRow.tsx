"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatBangkokDateTime } from "@/lib/bangkok-date";
import { ExternalIcon } from "@/components/icons";

type Booking = {
  id: string;
  buyer_name: string | null;
  buyer_email: string | null;
  scheduled_at: string;
  price_cents: number;
  status: "confirmed" | "cancelled";
  services: { name: string } | null;
  calendar_sync_status?: "not_connected" | "pending" | "synced" | "failed";
  google_meet_url?: string | null;
};

export function BookingRow({
  booking,
  updateStatus,
}: {
  booking: Booking;
  updateStatus?: (status: Booking["status"]) => Promise<void>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeStatus() {
    const nextStatus = booking.status === "confirmed" ? "cancelled" : "confirmed";
    if (
      nextStatus === "cancelled" &&
      !window.confirm(`ยกเลิกการจองของ ${booking.buyer_name || "ลูกค้า"} ใช่ไหม?`)
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (updateStatus) {
        await updateStatus(nextStatus);
      } else {
        const supabase = createClient();
        const { error: updateError } = await supabase
          .from("bookings")
          .update({ status: nextStatus })
          .eq("id", booking.id);
        if (updateError) throw updateError;
      }
      router.refresh();
    } catch (updateError) {
      setError(
        `อัปเดตการจองไม่สำเร็จ: ${
          updateError instanceof Error ? updateError.message : "กรุณาลองอีกครั้ง"
        }`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-xl border border-line bg-paper p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-ink">{booking.services?.name ?? "บริการ"}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              booking.status === "confirmed"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-paper-dim text-muted"
            }`}>
              {booking.status === "confirmed" ? "ยืนยันแล้ว" : "ยกเลิกแล้ว"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            {formatBangkokDateTime(new Date(booking.scheduled_at), {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
          <p className="mt-3 text-sm font-medium text-ink">{booking.buyer_name || "ไม่ระบุชื่อ"}</p>
          <p className="truncate text-xs text-muted">{booking.buyer_email || "ไม่ระบุอีเมล"}</p>
          {booking.calendar_sync_status === "synced" && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-emerald-700">
                อยู่ใน Google Calendar แล้ว
              </span>
              {booking.google_meet_url && (
                <a
                  href={booking.google_meet_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-ink underline underline-offset-4"
                >
                  เปิด Google Meet<ExternalIcon className="ml-1.5 inline size-3.5 align-[-0.15em]" />
                </a>
              )}
            </div>
          )}
          {booking.calendar_sync_status === "failed" && (
            <p className="mt-3 text-xs text-amber-700">
              เพิ่มลง Calendar ไม่สำเร็จ — การจองยังยืนยันตามปกติ
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold text-ink">฿{(booking.price_cents / 100).toLocaleString("th-TH")}</p>
          <button
            type="button"
            onClick={changeStatus}
            disabled={busy}
            className="mt-3 text-xs font-medium text-ink-soft underline underline-offset-4 hover:text-ink disabled:opacity-50"
          >
            {booking.status === "confirmed" ? "ยกเลิกการจอง" : "คืนสถานะการจอง"}
          </button>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
    </article>
  );
}
