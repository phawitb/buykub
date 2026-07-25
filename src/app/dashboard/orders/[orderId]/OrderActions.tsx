"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function OrderActions({
  orderId,
  status,
  updateStatus,
}: {
  orderId: string;
  status: "paid" | "refunded";
  updateStatus?: (status: "paid" | "refunded") => Promise<void>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div>
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
      {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  );
}
