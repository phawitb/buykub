"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

type Size = { width: number; height: number };

/** Pages further than this from the screen give their canvas back, so long PDFs stay light on phones. */
const KEEP_MARGIN = "150% 0px";

/**
 * Every page of a PDF drawn with pdf.js, so phones show the whole document
 * rather than only the first page a frame would. Pages draw as they near the
 * screen and are released once well past it.
 */
export function PdfReader({ src }: { src: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let loaded: PDFDocumentProxy | null = null;
    (async () => {
      // The legacy build also covers older phone browsers.
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      // Bundler-resolved module worker, the way the product editor loads pdf.js.
      pdfjs.GlobalWorkerOptions.workerPort ??= new Worker(new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
      loaded = await pdfjs.getDocument({ url: src }).promise;
      // Page shapes up front, so the scroll height is right before any page is drawn.
      const pages = await Promise.all(Array.from({ length: loaded.numPages }, (_, index) => loaded!.getPage(index + 1)));
      if (!active) return;
      setSizes(pages.map(page => { const { width, height } = page.getViewport({ scale: 1 }); return { width, height }; }));
      setPdf(loaded);
    })().catch(() => { if (active) setFailed(true); });
    return () => { active = false; void loaded?.destroy(); };
  }, [src]);

  if (failed) return <p role="alert" className="px-6 py-20 text-center text-sm text-muted">เปิด PDF ไม่สำเร็จ กรุณาโหลดหน้านี้ใหม่ หรือกดดาวน์โหลดไฟล์</p>;
  if (!pdf) return <p role="status" className="px-6 py-20 text-center text-sm text-muted">กำลังโหลด PDF...</p>;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 px-2 py-4 sm:gap-4 sm:px-4 sm:py-6">
      {sizes.map((size, index) => <PdfPage key={index} pdf={pdf} number={index + 1} size={size} total={sizes.length} />)}
    </div>
  );
}

function PdfPage({ pdf, number, size, total }: { pdf: PDFDocumentProxy; number: number; size: Size; total: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: KEEP_MARGIN });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!near || !canvas || !box) return;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    let cancelled = false;
    void pdf.getPage(number).then(page => {
      if (cancelled) return;
      // Sharp on high-density screens, capped so one page never takes too much memory.
      const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
      const viewport = page.getViewport({ scale: box.clientWidth / size.width * ratio });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvas, viewport });
      task.promise.catch(() => undefined);
    });
    return () => {
      cancelled = true;
      task?.cancel();
      // Hands the pixels back once the page is far away.
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [near, pdf, number, size.width]);

  return (
    <div ref={boxRef} role="img" aria-label={`หน้า ${number} จาก ${total}`} className="w-full overflow-hidden rounded-sm bg-white shadow-lift-1" style={{ aspectRatio: `${size.width} / ${size.height}` }}>
      <canvas ref={canvasRef} width={0} height={0} className="block size-full" />
    </div>
  );
}
