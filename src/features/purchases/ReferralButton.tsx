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
    <>
      <button type="button" onClick={share} disabled={state === "busy"} className="inline-flex h-11 items-center justify-center rounded-full border border-red-600 bg-paper px-5 text-sm font-medium text-red-600 transition duration-[120ms] ease-out hover:bg-red-50 active:scale-[0.98] disabled:opacity-60">
        {state === "busy" ? "กำลังสร้างลิงก์..." : `ชวนเพื่อน รับ ${ratePercent(rateBp)}`}
      </button>
      {state === "copied" && <p role="status" className="basis-full break-all text-xs text-emerald-700">คัดลอกลิงก์แล้ว · {message}</p>}
      {state === "error" && <p role="alert" className="basis-full text-xs text-red-600">{message}</p>}
    </>
  );
}
