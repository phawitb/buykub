"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatTHB } from "@/features/products/format";
import { ClassroomUpsellPopup } from "./ClassroomUpsellPopup";
import { createRemoteStore, type ProgressState, type RemoteStore } from "./remote-store";
import type { ClassroomUpsell } from "./upsell";

type EngineApp = { setState(state: ProgressState): void; getState(): ProgressState; destroy(): void };
type Upgrade = { href: string; label: string; price: string; compare?: string; text?: string };
type Engine = { mount(root: HTMLElement, pack: unknown, options: { store: RemoteStore; mascot: string; upgrade?: Upgrade }): EngineApp };
declare global { interface Window { ExamPrep?: Engine } }

// Static, content-free engine; the paid pack arrives separately from /api/courses/[id]/pack.
const ENGINE_JS = "/exam-prep/engine.js";
const ENGINE_CSS = "/exam-prep/engine.css";
const FONTS = "https://fonts.googleapis.com/css2?family=Mali:wght@400;500;600;700&family=Sarabun:wght@400;500;600;700&display=swap";

let engineLoad: Promise<Engine> | null = null;
function loadEngine(): Promise<Engine> {
  if (window.ExamPrep) return Promise.resolve(window.ExamPrep);
  engineLoad ??= new Promise<Engine>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = ENGINE_JS;
    script.async = true;
    script.onload = () => window.ExamPrep ? resolve(window.ExamPrep) : reject(new Error("engine"));
    script.onerror = () => { engineLoad = null; script.remove(); reject(new Error("engine")); };
    document.head.appendChild(script);
  });
  return engineLoad;
}

const syncLabels = { saved: "บันทึกความคืบหน้าแล้ว", pending: "กำลังบันทึก…", offline: "ออฟไลน์ · เก็บไว้ในเครื่องนี้ก่อน" };

export function ExamPrepClassroom({productId, name, expiresAt, owner, upsell}:{productId:string;name:string;expiresAt:string|null;owner:boolean;upsell?:ClassroomUpsell|null}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"loading"|"ready"|"error">("loading");
  const [sync, setSync] = useState<keyof typeof syncLabels>("saved");
  const [attempt, setAttempt] = useState(0);
  const full = upsell?.upgrade ?? null;
  // Plain strings only: the engine renders them into its own markup.
  const upgradeHref = full?.href, upgradePrice = full ? formatTHB(full.priceCents) : "", upgradeCompare = full?.compareCents && full.compareCents > full.priceCents ? formatTHB(full.compareCents) : undefined;

  useEffect(() => {
    let cancelled = false;
    let app: EngineApp | null = null;
    // BUYKUB is light-only; keep the classroom from switching to the engine's dark palette.
    const html = document.documentElement;
    const previousTheme = html.dataset.theme;
    html.dataset.theme = "light";
    const store = createRemoteStore(productId, {
      accept: state => { if (!app) return false; const before = app.getState(); app.setState(state); return app.getState() !== before; },
      onStatus: status => { if (!cancelled) setSync(status); },
    });
    (async () => {
      const [pack, engine] = await Promise.all([
        fetch(`/api/courses/${productId}/pack`, {cache:"no-store"}).then(response => { if (!response.ok) throw new Error("pack"); return response.json(); }),
        loadEngine(),
        store.pull(), // the newest copy from any device is in place before the engine reads it
      ]);
      if (cancelled || !rootRef.current) return;
      const upgrade = upgradeHref ? {href:upgradeHref, label:"ดูตัวเต็ม", price:upgradePrice, compare:upgradeCompare, text:"คลังข้อสอบเต็มชุด ข้อสอบจำลองจับเวลา และเฉลยทุกข้อ"} : undefined;
      app = engine.mount(rootRef.current, pack, {store, mascot:"/exam-prep/mascot.png", upgrade});
      setPhase("ready");
    })().catch(() => { if (!cancelled) setPhase("error"); });

    const onVisibility = () => {
      if (document.visibilityState === "hidden") void store.flush({keepalive:true});
      else void store.pull().then(state => { if (state) app?.setState(state); });
    };
    const onPageHide = () => void store.flush({keepalive:true});
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      void store.flush({keepalive:true});
      store.dispose();
      app?.destroy();
      if (previousTheme === undefined) delete html.dataset.theme; else html.dataset.theme = previousTheme;
    };
  }, [productId, attempt, upgradeHref, upgradePrice, upgradeCompare]);

  const access = owner ? "ตัวอย่างสำหรับผู้สอน" : expiresAt ? `เข้าเรียนได้ถึง ${new Date(expiresAt).toLocaleDateString("th-TH",{timeZone:"Asia/Bangkok",day:"numeric",month:"short",year:"numeric"})}` : "สิทธิ์ตลอดชีพ";
  return <div className="min-h-screen bg-[#fbfaf6] text-ink">
    <link rel="stylesheet" href={FONTS} precedence="default"/>
    <link rel="stylesheet" href={ENGINE_CSS} precedence="default"/>
    <header className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-paper px-4 py-2 text-xs sm:px-6">
      <Link href="/learn" className="shrink-0 font-semibold">‹ รายการที่สั่งซื้อ</Link>
      <span className="min-w-0 flex-1 truncate text-muted">{name} · {access}</span>
      {phase === "ready" && <span role="status" className={sync === "offline" ? "text-amber-700" : "text-muted"}>{syncLabels[sync]}</span>}
      {owner && <Link href={`/dashboard/products/${productId}/lessons`} className="shrink-0 underline">แก้ไขคอร์ส</Link>}
      {full && <Link href={full.href} className="shrink-0 rounded-full bg-accent px-3 py-1 font-semibold text-paper">อัปเกรดตัวเต็ม {formatTHB(full.priceCents)}</Link>}
    </header>
    {phase === "loading" && <p role="status" className="px-6 py-24 text-center text-sm text-muted">กำลังเปิดห้องเรียน…</p>}
    {phase === "error" && <div role="alert" className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-xl font-semibold">เปิดห้องเรียนไม่สำเร็จ</h1>
      <p className="mt-3 text-sm leading-7 text-muted">ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง ความคืบหน้าที่ทำไว้ยังอยู่ครบ</p>
      <button type="button" className="primary-button mt-6" onClick={() => { setPhase("loading"); setAttempt(n => n + 1); }}>ลองอีกครั้ง</button>
    </div>}
    <div ref={rootRef} hidden={phase !== "ready"}/>
    {upsell && phase === "ready" && <ClassroomUpsellPopup upsell={upsell}/>}
  </div>;
}
