"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { useRouter } from "next/navigation";

const DialogCloseContext = createContext<RefObject<(() => void) | null> | null>(null);

/** Let the existing editor own unsaved changes, uploads, and cleanup on dismissal. */
export function useWorkspaceDialog() {
  return useContext(DialogCloseContext);
}

export function WorkspaceDialog({ label, children }: { label: string; children: ReactNode }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeHandler = useRef<(() => void) | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current!;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>("input:not([type=hidden])")?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  function dismiss() {
    if (closeHandler.current) closeHandler.current();
    else router.back();
  }

  return <DialogCloseContext.Provider value={closeHandler}>
    <dialog ref={dialogRef} aria-label={label} aria-modal="true"
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onClick={(event) => { if (event.target === event.currentTarget) dismiss(); }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto overscroll-contain rounded-3xl border border-line bg-paper p-0 text-ink shadow-lift-4 backdrop:bg-ink/40 backdrop:backdrop-blur-sm">
      <div className="relative p-5 sm:p-8">
        <div className="sticky top-0 z-10 -mb-10 flex justify-end pointer-events-none">
          <button type="button" aria-label="ปิดหน้าต่างสินค้า" title="ปิดหน้าต่างสินค้า" onClick={dismiss} className="pointer-events-auto inline-flex size-10 items-center justify-center rounded-full border border-line bg-paper text-ink shadow-lift-1 hover:bg-paper-dim">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  </DialogCloseContext.Provider>;
}
