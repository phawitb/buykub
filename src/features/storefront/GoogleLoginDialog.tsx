"use client";

import { useEffect, useId, useRef, type RefObject } from "react";
import { GoogleButton } from "@/app/login/GoogleButton";
import { safeAuthRedirect } from "@/lib/auth";

export function GoogleLoginDialog({ next, onClose, returnFocus }: {
  next: string;
  onClose: () => void;
  returnFocus: RefObject<HTMLButtonElement | null>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = returnFocus.current;
    dialog.showModal();
    closeRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      trigger?.focus();
    };
  }, [returnFocus]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClose={(event) => { if (!event.currentTarget.open) onClose(); }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl border border-line bg-paper p-6 text-ink shadow-lift-4 backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-lg font-bold">เข้าสู่ระบบก่อนซื้อ</h2>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="ปิด" className="flex size-9 shrink-0 items-center justify-center rounded-full text-xl text-muted hover:bg-paper-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">×</button>
      </div>
      <p id={descriptionId} className="mb-6 text-sm leading-relaxed text-muted">ใช้บัญชี Google เพื่อรับสินค้าและดูประวัติการซื้อของคุณ</p>
      <GoogleButton next={safeAuthRedirect(next)} />
    </dialog>
  );
}
