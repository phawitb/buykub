"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { StripeCheckout } from "@/features/storefront/StripeCheckout";
import { PdfButton } from "@/features/purchases/PurchaseLibrary";
import { createClient } from "@/lib/supabase/client";
import { isGoogleUser } from "@/lib/auth";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";

type Access = { reason: "owner" | "active"; expiresAt: string | null };

function untilLabel(value: string | null) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" })
    : null;
}

/** Stays on the bottom edge of the screen while the buyer reads down the page. */
function PurchaseBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-[22px] pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_rgba(24,24,27,0.08)] backdrop-blur">
      <div className="mx-auto max-w-[596px]">{children}</div>
    </div>
  );
}

export function ProductPurchase({product}:{product:{id:string;shopId:string;name:string;priceCents:number;deliveryType:"file"|"key"|"course";availableStock?:number;courseAccessDays?:number|null;hasPdf?:boolean}}) {
  const [state,setState] = useState<"loading"|"guest"|"purchase"|"learn"|"error">("loading");
  const [access,setAccess] = useState<Access|null>(null);
  const [retry,setRetry] = useState(0);
  useEffect(() => {
    if(product.deliveryType !== "course") return;
    let alive = true;
    const supabase = createClient();
    async function check() {
      try {
        const {data:{user}} = await supabase.auth.getUser();
        if (!alive) return;
        if (!user || !isGoogleUser(user)) {setState("guest");return;}
        const {data,error} = await supabase.rpc("course_access", {p_product_id:product.id});
        if (!alive) return;
        if(error) {setState("error");return;}
        if(data?.allowed) setAccess({reason:data.reason === "owner" ? "owner" : "active",expiresAt:data.expires_at ?? null});
        setState(data?.allowed ? "learn" : "purchase");
      } catch { if(alive) setState("error"); }
    }
    void check();
    return () => {alive=false;};
  },[product.deliveryType,product.id,retry]);
  if(product.deliveryType !== "course") return <PurchaseBar><StripeCheckout product={product}/></PurchaseBar>;
  const until = untilLabel(access?.expiresAt ?? null);
  return <PurchaseBar>
    {state === "loading" && <button disabled className="primary-button w-full">กำลังตรวจสอบสิทธิ์...</button>}
    {state === "learn" && <>
      <p className="mb-2 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-emerald-700">
        <CheckIcon className="size-4 shrink-0" />
        {access?.reason === "owner" ? "คอร์สของร้านคุณ เข้าดูได้ทุกเมื่อ" : until ? `คุณมีสิทธิ์เข้าเรียนคอร์สนี้แล้ว · ถึง ${until}` : "คุณมีสิทธิ์เข้าเรียนคอร์สนี้แล้ว"}
      </p>
      <div className="flex gap-2">
        <Link href={`/learn/${product.id}`} className="primary-button group flex flex-1 items-center justify-center gap-2">เข้าเรียนคอร์สนี้<ArrowRightIcon className="size-4 transition-transform duration-[200ms] ease-out group-hover:translate-x-0.5" /></Link>
        {product.hasPdf && <PdfButton href={`/api/courses/${encodeURIComponent(product.id)}/pdf`} />}
      </div>
    </>}
    {(state === "guest" || state === "purchase") && <StripeCheckout product={product}/>}
    {state === "error" && <div role="alert" className="text-center text-sm text-red-600">ตรวจสอบสิทธิ์ไม่สำเร็จ <button className="underline" onClick={() => {setState("loading");setRetry(value => value+1);}}>ลองอีกครั้ง</button></div>}
  </PurchaseBar>;
}
