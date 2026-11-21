"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

export type CropRegion = { sx: number; sy: number; sw: number; sh: number };
export type RenderCrop = (file: File, region: CropRegion, width: number, height: number) => Promise<File>;

const MAX_ZOOM = 4;

/** The image's width and height, or null where the browser cannot decode it here. */
export async function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

/** Whether the image is far enough from the frame's shape that the seller should pick the part shown. */
export function needsCrop(size: { width: number; height: number }, aspect: number) {
  return Math.abs(size.width / size.height - aspect) / aspect > 0.02;
}

export const renderCrop: RenderCrop = async (file, region, width, height) => {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("เบราว์เซอร์นี้ไม่รองรับการครอปรูป");
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, region.sx, region.sy, region.sw, region.sh, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("ครอปรูปไม่สำเร็จ");
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "image"}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
};

type View = { zoom: number; x: number; y: number };

/** Keeps the image covering the whole frame. */
function clamp(view: View, frame: { w: number; h: number }, base: number, image: { width: number; height: number }): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, view.zoom));
  const w = image.width * base * zoom;
  const h = image.height * base * zoom;
  return { zoom, x: Math.min(0, Math.max(frame.w - w, view.x)), y: Math.min(0, Math.max(frame.h - h, view.y)) };
}

/**
 * A frame in the shape the image will be shown at. The seller drags the image
 * to choose which part sits inside it, and zooms with the slider, the wheel or
 * two fingers.
 */
export function ImageCropper({ file, size, aspect, outputWidth, round = false, onCancel, onConfirm, render = renderCrop }: {
  file: File;
  size: { width: number; height: number };
  aspect: number;
  outputWidth: number;
  round?: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => void;
  render?: RenderCrop;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [url] = useState(() => URL.createObjectURL(file));
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [chosen, setChosen] = useState<View | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const measure = () => setFrame({ w: element.clientWidth, h: element.clientHeight });
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);

  const base = frame.w && frame.h ? Math.max(frame.w / size.width, frame.h / size.height) : 0;

  // Starts centred, and stays inside the frame when the frame is resized.
  const view = base
    ? clamp(chosen ?? { zoom: 1, x: (frame.w - size.width * base) / 2, y: (frame.h - size.height * base) / 2 }, frame, base, size)
    : null;

  /** Zooms keeping the given point of the frame still. */
  function zoomTo(zoom: number, at = { x: frame.w / 2, y: frame.h / 2 }) {
    if (!view) return;
    const next = Math.min(MAX_ZOOM, Math.max(1, zoom));
    const ratio = next / view.zoom;
    setChosen(clamp({ zoom: next, x: at.x - (at.x - view.x) * ratio, y: at.y - (at.y - view.y) * ratio }, frame, base, size));
  }

  function down(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinch.current = null;
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const last = pointers.current.get(event.pointerId);
    if (!last || !view) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const box = frameRef.current!.getBoundingClientRect();
      if (pinch.current) zoomTo(view.zoom * (distance / pinch.current), { x: (a.x + b.x) / 2 - box.left, y: (a.y + b.y) / 2 - box.top });
      pinch.current = distance;
      return;
    }
    setChosen(clamp({ ...view, x: view.x + event.clientX - last.x, y: view.y + event.clientY - last.y }, frame, base, size));
  }

  function up(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    pinch.current = null;
  }

  async function confirm() {
    if (!view || !base) return;
    const scale = base * view.zoom;
    const region = { sx: -view.x / scale, sy: -view.y / scale, sw: frame.w / scale, sh: frame.h / scale };
    setWorking(true);
    setError(null);
    try {
      onConfirm(await render(file, region, outputWidth, Math.round(outputWidth / aspect)));
    } catch (cropError) {
      setError(cropError instanceof Error ? cropError.message : "ครอปรูปไม่สำเร็จ");
      setWorking(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-paper p-3">
      <p className="text-xs font-medium text-ink-soft">ลากรูปเพื่อเลือกส่วนที่จะแสดง ซูมเข้าออกได้</p>
      <div
        ref={frameRef}
        role="img"
        aria-label="กรอบเลือกส่วนของรูป"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={(event) => {
          if (!view) return;
          const box = event.currentTarget.getBoundingClientRect();
          zoomTo(view.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1), { x: event.clientX - box.left, y: event.clientY - box.top });
        }}
        className={`relative mt-2 w-full cursor-grab touch-none select-none overflow-hidden bg-paper-dim active:cursor-grabbing ${round ? "mx-auto max-w-64 rounded-full" : "rounded-lg"}`}
        style={{ aspectRatio: String(aspect) }}
      >
        {view && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute left-0 top-0 max-w-none"
            style={{ width: size.width * base * view.zoom, height: size.height * base * view.zoom, transform: `translate(${view.x}px, ${view.y}px)` }}
          />
        )}
        <div aria-hidden className={`pointer-events-none absolute inset-0 ring-2 ring-inset ring-white/80 ${round ? "rounded-full" : "rounded-lg"}`} />
      </div>
      <label className="mt-3 flex items-center gap-3 text-xs text-muted">
        <span className="shrink-0">ซูม</span>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={view?.zoom ?? 1}
          onChange={(event) => zoomTo(Number(event.target.value))}
          aria-label="ซูมรูป"
          className="w-full accent-accent"
        />
      </label>
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={!view || working} onClick={() => void confirm()} className="primary-button h-9 px-4 text-xs">
          {working ? "กำลังครอป..." : "ใช้ส่วนนี้"}
        </button>
        <button type="button" disabled={working} onClick={onCancel} className="secondary-button h-9 px-4 text-xs">ยกเลิก</button>
      </div>
    </div>
  );
}
