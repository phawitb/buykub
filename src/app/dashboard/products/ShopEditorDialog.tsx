"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ShopIcon, shopIconButton } from "./ShopIcon";

export function ShopEditorDialog({ children, busy, title, description, onClose }: {
  children: ReactNode;
  busy: boolean;
  title: string;
  description: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current!;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    const firstField = dialog.querySelector<HTMLInputElement | HTMLTextAreaElement>('input:not([type="file"]), textarea');
    (firstField ?? dialog.querySelector<HTMLButtonElement>("button"))?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby="shop-editor-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto overscroll-contain rounded-3xl border border-line bg-paper p-0 text-ink shadow-lift-4 backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
    >
      <div className="p-5 sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 id="shop-editor-title" className="text-xl font-bold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{description}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="ปิดตัวแก้ไข" title="ปิดตัวแก้ไข" className={shopIconButton}><ShopIcon name="close" /></button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
