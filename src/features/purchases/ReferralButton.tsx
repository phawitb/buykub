"use client";

import { useState } from "react";
import { ratePercent } from "@/lib/affiliates/referral";

/** Copies the buyer's referral link, or opens the phone's share sheet when there is one. */
export function ReferralButton({ productId, rateBp, name }: { productId: string; rateBp: number; name: string }) {
  const [state, setState] = useState<"idle" | "busy" | "copied" | "error">("idle");
  const [message, setMessage] = useState("");

  async function share() {
    setState("busy");
    try {
      const response = await fetch("/api/affiliate/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body.url !== "string") throw new Error(body.error || "สร้างลิงก์ไม่สำเร็จ กรุณาลองใหม่");
      if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
        try { await navigator.share({ title: name, url: body.url }); setState("idle"); return; }
        catch (error) { if ((error as Error).name === "AbortError") { setState("idle"); return; } }
      }
      await navigator.clipboard.writeText(body.url);
      setMessage(body.url);
      setState("copied");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "สร้างลิงก์ไม่สำเร็จ กรุณาลองใหม่");
      setState("error");
    }
  }

  return (
    <div className="w-full">
      <button type="button" onClick={share} disabled={state === "busy"} className="secondary-button disabled:opacity-60">
        {state === "busy" ? "กำลังสร้างลิงก์..." : `ชวนเพื่อน รับ ${ratePercent(rateBp)}`}
      </button>
      {state === "copied" && <p role="status" className="mt-2 break-all text-xs text-emerald-700">คัดลอกลิงก์แล้ว · {message}</p>}
      {state === "error" && <p role="alert" className="mt-2 text-xs text-red-600">{message}</p>}
    </div>
  );
}
