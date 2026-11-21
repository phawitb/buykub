"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRightIcon, CloseIcon } from "@/components/icons";

export type PublicPreview = { id: string; publicUrl: string; width: number; height: number };

/** Enough to show what the product looks like without pushing the FAQ and buy button far down. */
export const PREVIEWS_SHOWN_FIRST = 6;

const navButton =
  "flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/**
 * Sample images as a grid of whole thumbnails; any one opens full screen with
 * the rest a swipe or arrow key away.
 */
export function ProductPreviewGallery({ previews, productName }: { previews: PublicPreview[]; productName: string }) {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const shown = expanded ? previews : previews.slice(0, PREVIEWS_SHOWN_FIRST);
  const more = previews.length - shown.length;

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((preview, index) => (
          <button
            key={preview.id}
            type="button"
            onClick={() => setOpen(index)}
            aria-label={`ดูตัวอย่าง ${index + 1} จาก ${previews.length}`}
            className="group relative block aspect-[3/4] overflow-hidden rounded-element border border-line bg-paper-dim transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.publicUrl}
              alt={`ตัวอย่าง ${index + 1} ของ ${productName}`}
              width={preview.width || undefined}
              height={preview.height || undefined}
              loading="lazy"
              className="size-full object-contain transition group-hover:scale-[1.02]"
            />
          </button>
        ))}
      </div>
      {more > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1 rounded-lg border border-line bg-paper text-sm font-semibold text-ink transition hover:bg-paper-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          ดูตัวอย่างทั้งหมด {previews.length} รูป (อีก {more})
        </button>
      )}
      {open !== null && (
        <PreviewViewer previews={previews} productName={productName} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

function PreviewViewer({ previews, productName, index, onIndex, onClose }: {
  previews: PublicPreview[];
  productName: string;
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);
  const preview = previews[index];
  const last = previews.length - 1;
  const go = (next: number) => onIndex(Math.min(last, Math.max(0, next)));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      trigger?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label={`ตัวอย่าง ${index + 1} จาก ${previews.length}`}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") go(index - 1);
        if (event.key === "ArrowRight") go(index + 1);
      }}
      onTouchStart={(event) => { touchX.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        const start = touchX.current;
        const end = event.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start === null || end === undefined || Math.abs(end - start) < 40) return;
        go(end < start ? index + 1 : index - 1);
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-black/90 p-0 text-white backdrop:bg-black/60"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm font-semibold tabular-nums">{index + 1} / {previews.length}</span>
          <button type="button" onClick={onClose} aria-label="ปิด" autoFocus className={navButton}>
            <CloseIcon className="size-5" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center gap-2 px-2 pb-4 sm:px-4">
          <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="รูปก่อนหน้า" className={`${navButton} hidden sm:flex`}>
            <ChevronRightIcon className="size-5 rotate-180" />
          </button>
          <div className="flex h-full min-w-0 flex-1 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={preview.id}
              src={preview.publicUrl}
              alt={`ตัวอย่าง ${index + 1} ของ ${productName}`}
              width={preview.width || undefined}
              height={preview.height || undefined}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          </div>
          <button type="button" onClick={() => go(index + 1)} disabled={index === last} aria-label="รูปถัดไป" className={`${navButton} hidden sm:flex`}>
            <ChevronRightIcon className="size-5" />
          </button>
        </div>
        {/* Phones swipe; the buttons stay for those who don't. */}
        <div className="flex justify-center gap-6 pb-5 sm:hidden">
          <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="รูปก่อนหน้า" className={navButton}>
            <ChevronRightIcon className="size-5 rotate-180" />
          </button>
          <button type="button" onClick={() => go(index + 1)} disabled={index === last} aria-label="รูปถัดไป" className={navButton}>
            <ChevronRightIcon className="size-5" />
          </button>
        </div>
      </div>
    </dialog>
  );
}
