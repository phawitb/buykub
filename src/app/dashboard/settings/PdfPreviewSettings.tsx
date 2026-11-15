"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_PDF_PREVIEW_PREFERENCES,
  PDF_PREVIEW_LIMITS,
  watermarkLabel,
  type PdfPreviewPreferences,
} from "@/features/products/pdf/preferences";
import { drawProtectedPreview } from "@/features/products/pdf/watermark";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
  shopName: string | null;
  initial: PdfPreviewPreferences;
  savePreferences?: (preferences: PdfPreviewPreferences) => Promise<void>;
};

const PREVIEW_WIDTH = 420;
const PREVIEW_HEIGHT = 560;

/** A stand-in document page, so the preview shows the real blur and marks. */
function drawSamplePage(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#111111";
  context.font = "600 30px system-ui, sans-serif";
  context.fillText("ตัวอย่างหน้าเอกสาร", 36, 72);
  context.fillStyle = "#9a9a9a";
  context.font = "400 17px system-ui, sans-serif";
  context.fillText("หน้าที่ 2 ของไฟล์ PDF", 36, 104);

  context.fillStyle = "#d8d8d8";
  let y = 142;
  for (let line = 0; line < 18; line += 1) {
    const width = line % 5 === 4 ? 180 : canvas.width - 72 - (line % 3) * 18;
    context.fillRect(36, y, width, 11);
    y += 24;
    if (line === 7) y += 14;
  }
  context.fillStyle = "#ececec";
  context.fillRect(36, y + 10, canvas.width - 72, 90);
}

export function PdfPreviewSettings({ userId, shopName, initial, savePreferences }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<PdfPreviewPreferences>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const display = displayRef.current;
    const context = display?.getContext("2d");
    if (!display || !context) return;
    const source = document.createElement("canvas");
    source.width = PREVIEW_WIDTH;
    source.height = PREVIEW_HEIGHT;
    drawSamplePage(source);
    const rendered = value.watermarkEnabled
      ? drawProtectedPreview(source, {
          blurStrength: value.blurStrength,
          watermarkOpacity: value.watermarkOpacity,
          watermarkText: watermarkLabel(value, shopName),
        })
      : source;
    context.clearRect(0, 0, display.width, display.height);
    context.drawImage(rendered, 0, 0);
  }, [shopName, value]);

  function update(patch: Partial<PdfPreviewPreferences>) {
    setValue((current) => ({ ...current, ...patch }));
    setSaved(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      if (savePreferences) await savePreferences(value);
      else {
        const { error: dbError } = await createClient()
          .from("seller_pdf_preferences")
          .upsert(
            {
              user_id: userId,
              preview_page_count: value.previewPageCount,
              watermark_enabled: value.watermarkEnabled,
              watermark_text: value.watermarkText,
              blur_strength: value.blurStrength,
              watermark_opacity: value.watermarkOpacity,
            },
            { onConflict: "user_id" },
          )
          .select("user_id")
          .single();
        if (dbError) throw dbError;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-ink">รูปตัวอย่างจากไฟล์ PDF</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          เมื่อสร้างสินค้าจากไฟล์ PDF ระบบใช้หน้าแรกเป็นรูปหลักของสินค้า และหน้าถัด ๆ ไปเป็นรูป
          ตัวอย่างที่ติดลายน้ำและเบลอไว้ เพื่อให้ลูกค้าเห็นเนื้อหาจริงแต่ใช้แทนตัวสินค้าไม่ได้
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-[1fr_auto]">
        <div className="space-y-5">
          <label className="field-label">
            จำนวนรูปที่สร้างจาก PDF
            <select
              className="field-input mt-2"
              value={value.previewPageCount}
              onChange={(event) => update({ previewPageCount: Number(event.target.value) })}
            >
              {Array.from(
                { length: PDF_PREVIEW_LIMITS.previewPageCount.max },
                (_, index) => index + 1,
              ).map((count) => (
                <option key={count} value={count}>
                  {count} หน้าแรก
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-xs text-muted">
              หน้าแรกเป็นรูปหลักเสมอ อีก {Math.max(0, value.previewPageCount - 1)} หน้าเป็นรูปตัวอย่าง
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-line bg-paper-dim p-4">
            <input
              type="checkbox"
              checked={value.watermarkEnabled}
              onChange={(event) => update({ watermarkEnabled: event.target.checked })}
              className="mt-0.5 size-4 shrink-0"
            />
            <span>
              <span className="block text-sm font-medium text-ink">ติดลายน้ำและเบลอหน้าตัวอย่าง</span>
              <span className="mt-1 block text-xs leading-5 text-muted">
                ปิดได้ถ้าต้องการโชว์ทุกหน้าแบบคมชัด แต่ลูกค้าจะอ่านเนื้อหาจากรูปได้เลย
              </span>
            </span>
          </label>

          <fieldset disabled={!value.watermarkEnabled} className="space-y-5 disabled:opacity-50">
            <label className="field-label">
              ข้อความลายน้ำ
              <input
                className="field-input mt-2"
                maxLength={PDF_PREVIEW_LIMITS.watermarkText.max}
                value={value.watermarkText}
                placeholder={watermarkLabel(
                  { ...value, watermarkText: "" },
                  shopName,
                )}
                onChange={(event) => update({ watermarkText: event.target.value })}
              />
              <span className="mt-1.5 block text-xs text-muted">
                เว้นว่างไว้เพื่อใช้ชื่อร้านของคุณ
              </span>
            </label>

            <label className="field-label">
              ความเบลอ · {value.blurStrength}px
              <input
                type="range"
                className="mt-3 block w-full accent-[var(--accent)]"
                min={PDF_PREVIEW_LIMITS.blurStrength.min}
                max={PDF_PREVIEW_LIMITS.blurStrength.max}
                step={1}
                value={value.blurStrength}
                onChange={(event) => update({ blurStrength: Number(event.target.value) })}
              />
            </label>

            <label className="field-label">
              ความเข้มลายน้ำ · {value.watermarkOpacity}%
              <input
                type="range"
                className="mt-3 block w-full accent-[var(--accent)]"
                min={PDF_PREVIEW_LIMITS.watermarkOpacity.min}
                max={PDF_PREVIEW_LIMITS.watermarkOpacity.max}
                step={5}
                value={value.watermarkOpacity}
                onChange={(event) => update({ watermarkOpacity: Number(event.target.value) })}
              />
            </label>
          </fieldset>
        </div>

        <div className="w-full md:w-56">
          <p className="text-xs font-medium text-ink-soft">ตัวอย่างผลลัพธ์</p>
          <canvas
            ref={displayRef}
            width={PREVIEW_WIDTH}
            height={PREVIEW_HEIGHT}
            role="img"
            aria-label={
              value.watermarkEnabled
                ? "ตัวอย่างรูปหน้าที่ 2 ที่ติดลายน้ำและเบลอแล้ว"
                : "ตัวอย่างรูปหน้าที่ 2 แบบไม่ติดลายน้ำ"
            }
            className="mt-2 block h-auto w-full rounded-element border border-line bg-paper"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-sm font-medium text-emerald-700" role="status">
          บันทึกการตั้งค่าแล้ว
        </p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="primary-button">
          {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
        </button>
        <button
          type="button"
          onClick={() => update(DEFAULT_PDF_PREVIEW_PREFERENCES)}
          className="secondary-button"
        >
          คืนค่าเริ่มต้น
        </button>
      </div>
    </form>
  );
}
