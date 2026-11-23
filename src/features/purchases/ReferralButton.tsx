"use client";

import { useState } from "react";
import Link from "next/link";
import { ratePercent } from "@/lib/affiliates/referral";

/** Copies the buyer's referral link, or opens the phone's share sheet when there is one. */
export function ReferralButton({ productId, rateBp, priceCents, name }: { productId: string; rateBp: number; priceCents: number; name: string }) {
  const [state, setState] = useState<"idle" | "busy" | "copied" | "error">("idle");
  const [message, setMessage] = useState("");
  // The how-to opens once the buyer has the link in hand, and stays open.
  const [explained, setExplained] = useState(false);

  async function share() {
    setState("busy");
    try {
      const response = await fetch("/api/affiliate/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body.url !== "string") throw new Error(body.error || "สร้างลิงก์ไม่สำเร็จ กรุณาลองใหม่");
      setExplained(true);
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
      {explained && <ReferralHowTo rateBp={rateBp} priceCents={priceCents} />}
    </>
  );
}

function baht(cents: number) {
  return `฿${(cents / 100).toLocaleString("th-TH", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** What to do with the link and what one referred sale pays, in the words of the affiliate page. */
function ReferralHowTo({ rateBp, priceCents }: { rateBp: number; priceCents: number }) {
  const earns = Math.floor(priceCents * rateBp / 10000);
  return (
    <div className="basis-full rounded-xl bg-paper-dim px-4 py-3 text-xs leading-6 text-ink-soft">
      {earns > 0 && (
        <p className="text-sm text-ink">
          เพื่อนซื้อผ่านลิงก์ 1 ครั้ง คุณได้ <span className="font-semibold">{baht(earns)}</span>
          <span className="text-muted"> ({ratePercent(rateBp)} ของราคา {baht(priceCents)})</span>
        </p>
      )}
      <ol className="mt-1 list-decimal pl-4">
        <li>กดปุ่มเพื่อคัดลอกลิงก์ แล้วส่งให้เพื่อนทาง LINE, Facebook หรือแชทไหนก็ได้</li>
        <li>เพื่อนเปิดลิงก์แล้วซื้อภายใน 30 วัน ระบบนับเป็นยอดของคุณ เพื่อนจ่ายราคาเดิม</li>
        <li>ค่าคอมพร้อมโอนหลังร้านได้รับเงินจากออเดอร์นั้น (อย่างน้อย 7 วันหลังซื้อ) ทีมงานโอนให้เดือนละครั้ง</li>
      </ol>
      <p className="mt-1 text-muted">ถ้าเพื่อนใช้โค้ดส่วนลด ค่าคอมคิดจากราคาที่จ่ายจริง · ออเดอร์ที่ถูกคืนเงินไม่ได้ค่าคอม</p>
      <Link href="/learn/affiliate" className="mt-1 inline-block font-medium text-accent-text hover:underline">ดูยอดและตั้งบัญชีรับเงิน →</Link>
    </div>
  );
}
