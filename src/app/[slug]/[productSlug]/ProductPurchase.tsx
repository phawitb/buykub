"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StripeCheckout } from "@/features/storefront/StripeCheckout";
import { createClient } from "@/lib/supabase/client";
import { isGoogleUser } from "@/lib/auth";
import { ArrowRightIcon } from "@/components/icons";

export function ProductPurchase({product}:{product:{id:string;shopId:string;name:string;priceCents:number;deliveryType:"file"|"key"|"course";availableStock?:number;courseAccessDays?:number|null}}) {
  const [state,setState] = useState<"loading"|"guest"|"purchase"|"learn"|"error">("loading");
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
        setState(data?.allowed ? "learn" : "purchase");
      } catch { if(alive) setState("error"); }
    }
    void check();
    return () => {alive=false;};
  },[product.deliveryType,product.id,retry]);
  if(product.deliveryType !== "course") return <StripeCheckout product={product}/>;
  return <div>
    <p className="mb-3 text-center text-xs text-muted">ชำระครั้งเดียว · {product.courseAccessDays ? `เข้าเรียนได้ ${product.courseAccessDays.toLocaleString("th-TH")} วัน หลังชำระสำเร็จ` : "เข้าเรียนได้ตลอดชีพ"}</p>
    {state === "loading" && <button disabled className="primary-button w-full">กำลังตรวจสอบสิทธิ์...</button>}
    {state === "learn" && <Link href={`/learn/${product.id}`} className="primary-button group flex w-full items-center justify-center gap-2">เข้าเรียนคอร์สนี้<ArrowRightIcon className="size-4 transition-transform duration-[200ms] ease-out group-hover:translate-x-0.5" /></Link>}
    {(state === "guest" || state === "purchase") && <StripeCheckout product={product}/>}
    {state === "error" && <div role="alert" className="text-center text-sm text-red-600">ตรวจสอบสิทธิ์ไม่สำเร็จ <button className="underline" onClick={() => {setState("loading");setRetry(value => value+1);}}>ลองอีกครั้ง</button></div>}
  </div>;
}
