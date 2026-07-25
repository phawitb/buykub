"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  uploadShopAsset,
  type UploadRequest,
  type UploadResult,
} from "@/lib/supabase/upload";

export type ServiceFormValues = {
  name: string;
  price_cents: number;
  duration_minutes: number;
  description: string | null;
  image_url: string | null;
  image_path?: string | null;
  meet_link: string | null;
  availability: {
    days?: number[];
    start?: string;
    end?: string;
    buffer_minutes?: number;
    advance_days?: number;
  } | null;
};

const DURATIONS = [
  { label: "15 นาที", value: 15 },
  { label: "30 นาที", value: 30 },
  { label: "45 นาที", value: 45 },
  { label: "1 ชั่วโมง", value: 60 },
  { label: "1.5 ชั่วโมง", value: 90 },
  { label: "2 ชั่วโมง", value: 120 },
];

const WEEKDAYS = [
  { label: "จ", value: 1 },
  { label: "อ", value: 2 },
  { label: "พ", value: 3 },
  { label: "พฤ", value: 4 },
  { label: "ศ", value: 5 },
  { label: "ส", value: 6 },
  { label: "อา", value: 0 },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
    .toString()
    .padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

export function ServiceNewForm({
  shopId,
  userId,
  serviceId,
  initialValues,
  uploadAsset = uploadShopAsset,
}: {
  shopId: string;
  userId: string;
  serviceId?: string;
  initialValues?: ServiceFormValues;
  uploadAsset?: (request: UploadRequest) => Promise<UploadResult>;
}) {
  const router = useRouter();
  const availability = initialValues?.availability;
  const [name, setName] = useState(initialValues?.name ?? "");
  const [price, setPrice] = useState(
    initialValues ? String(initialValues.price_cents / 100) : "",
  );
  const [duration, setDuration] = useState(initialValues?.duration_minutes ?? 30);
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(initialValues?.image_url ?? null);
  const [imagePath, setImagePath] = useState<string | null>(initialValues?.image_path ?? null);
  const [meetLink, setMeetLink] = useState(initialValues?.meet_link ?? "");
  const [days, setDays] = useState<number[]>(availability?.days ?? [1, 2, 3, 4, 5]);
  const [start, setStart] = useState(availability?.start ?? "09:00");
  const [end, setEnd] = useState(availability?.end ?? "18:00");
  const [buffer, setBuffer] = useState(availability?.buffer_minutes ?? 15);
  const [advanceDays, setAdvanceDays] = useState(availability?.advance_days ?? 30);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function toggleDay(d: number) {
    setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    try {
      const result = await uploadAsset({
        userId,
        file,
        destination: "product-image",
        signal: new AbortController().signal,
        onProgress: (percent) => setUploadProgress(percent),
      });
      setImageUrl(result.publicUrl);
      setImagePath(result.path);
      setUploadProgress(100);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    const supabase = createClient();
    const payload = {
      shop_id: shopId,
      name,
      description,
      price_cents: Math.round(parseFloat(price || "0") * 100),
      duration_minutes: duration,
      image_url: imageUrl,
      image_path: imagePath,
      meet_link: meetLink || null,
      availability: { days, start, end, buffer_minutes: buffer, advance_days: advanceDays },
    };
    const { error } = serviceId
      ? await supabase.from("services").update(payload).eq("id", serviceId).eq("shop_id", shopId)
      : await supabase.from("services").insert(payload);

    setSaving(false);
    if (error) {
      setSaveError(`บันทึกบริการไม่สำเร็จ: ${error.message}`);
      return;
    }
    router.push("/dashboard/bookings");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="rounded-2xl border border-line bg-paper-dim p-6">
        <h2 className="text-sm font-semibold text-ink">ข้อมูลบริการ</h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">ชื่อบริการ *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="เช่น คอนซัลต์ 1:1"
              className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">ราคา (บาท) *</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              type="number"
              min="0"
              placeholder="499"
              className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">ระยะเวลา *</label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDuration(d.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    duration === d.value
                      ? "border-accent bg-accent text-paper"
                      : "border-line text-ink-soft hover:text-ink"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">รายละเอียด</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="อธิบายบริการของคุณ..."
              className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">รูปบริการ</label>
            <label className="relative flex min-h-36 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-paper text-center text-xs text-muted hover:border-accent">
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
              )}
              <span className="relative font-medium">
                {imageUrl ? "อัปโหลดแล้ว ✓ (คลิกเพื่อเปลี่ยน)" : "ลากไฟล์มาวางที่นี่ หรือ คลิกเพื่อเลือก"}
              </span>
              <input
                type="file"
                accept="image/*"
                aria-label="รูปบริการ"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
            {uploading && (
              <div
                className="mt-2"
                role="progressbar"
                aria-label="กำลังอัปโหลดรูปบริการ"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadProgress}
              >
                <div className="flex justify-between text-xs text-muted">
                  <span>กำลังอัปโหลดรูปบริการ</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
            {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">
              ลิงก์ประชุม (Zoom / Google Meet)
            </label>
            <input
              value={meetLink}
              onChange={(e) => setMeetLink(e.target.value)}
              placeholder="https://meet.google.com/xxx-yyyy-zzz"
              className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
            />
            <p className="mt-1 text-xs text-muted">ลูกค้าจะได้รับลิงก์นี้หลังจองสำเร็จ</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-paper-dim p-6">
        <h2 className="text-sm font-semibold text-ink">ตั้งค่าเวลาว่าง</h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">วันที่เปิดรับจอง</label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`h-9 w-9 rounded-full border text-xs font-medium ${
                    days.includes(d.value)
                      ? "border-ink bg-ink text-paper"
                      : "border-line text-ink-soft hover:text-ink"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">เวลาเริ่ม</label>
              <select
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">เวลาสิ้นสุด</label>
              <select
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">
                เวลาพักระหว่างรอบ
              </label>
              <div className="flex flex-wrap gap-2">
                {[{ label: "ไม่พัก", value: 0 }, { label: "15 นาที", value: 15 }, { label: "30 นาที", value: 30 }, { label: "45 นาที", value: 45 }].map((option) => (
                  <button key={option.value} type="button" onClick={() => setBuffer(option.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${buffer === option.value ? "border-ink bg-ink text-paper" : "border-line text-ink-soft hover:text-ink"}`}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">
                จองล่วงหน้าได้ (วัน)
              </label>
              <input
                value={advanceDays}
                onChange={(e) => setAdvanceDays(Number(e.target.value))}
                type="number"
                min="1"
                className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || uploading}
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper transition hover:bg-accent-hover disabled:opacity-60"
        >
          {saving ? "กำลังบันทึก..." : serviceId ? "บันทึกการแก้ไข" : "สร้างบริการจอง"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard/bookings")}
          className="text-sm text-muted hover:text-ink"
        >
          ยกเลิก
        </button>
      </div>
      {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
    </form>
  );
}
