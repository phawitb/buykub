"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadShopAsset } from "@/lib/supabase/upload";

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

export function ServiceNewForm({ shopId, userId }: { shopId: string; userId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState(30);
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [meetLink, setMeetLink] = useState("");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [buffer, setBuffer] = useState(15);
  const [advanceDays, setAdvanceDays] = useState(30);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  function toggleDay(d: number) {
    setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadShopAsset(userId, file);
      setImageUrl(url);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const supabase = createClient();
    await supabase.from("services").insert({
      shop_id: shopId,
      name,
      description,
      price_cents: Math.round(parseFloat(price || "0") * 100),
      duration_minutes: duration,
      image_url: imageUrl,
      meet_link: meetLink || null,
      availability: { days, start, end, buffer_minutes: buffer, advance_days: advanceDays },
    });

    setSaving(false);
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
                      ? "border-ink bg-ink text-paper"
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
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line bg-paper py-8 text-center text-xs text-muted hover:border-ink">
              {imageUrl ? "อัปโหลดแล้ว ✓ (คลิกเพื่อเปลี่ยน)" : "ลากไฟล์มาวางที่นี่ หรือ คลิกเพื่อเลือก"}
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">
                เวลาพักระหว่างรอบ
              </label>
              <select
                value={buffer}
                onChange={(e) => setBuffer(Number(e.target.value))}
                className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
              >
                <option value={0}>ไม่พัก</option>
                <option value={15}>15 นาที</option>
                <option value={30}>30 นาที</option>
              </select>
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
          className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-paper transition hover:opacity-85 disabled:opacity-60"
        >
          {saving ? "กำลังสร้าง..." : "สร้างบริการจอง"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard/bookings")}
          className="text-sm text-muted hover:text-ink"
        >
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
