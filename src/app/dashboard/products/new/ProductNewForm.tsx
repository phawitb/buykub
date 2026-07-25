"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadShopAsset } from "@/lib/supabase/upload";

const CATEGORIES = [
  "PROMPT PACK",
  "E-BOOK",
  "TEMPLATE",
  "COURSE",
  "PRESET",
  "GRAPHIC",
  "FONT",
  "MUSIC",
  "OTHER",
];

export function ProductNewForm({ shopId, userId }: { shopId: string; userId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [comparePrice, setComparePrice] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [description, setDescription] = useState("");
  const [highlights, setHighlights] = useState<string[]>([]);
  const [highlightDraft, setHighlightDraft] = useState("");
  const [faq, setFaq] = useState<{ q: string; a: string }[]>([]);
  const [faqQ, setFaqQ] = useState("");
  const [faqA, setFaqA] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  function addHighlight() {
    if (!highlightDraft.trim()) return;
    setHighlights((h) => [...h, highlightDraft.trim()]);
    setHighlightDraft("");
  }

  function addFaq() {
    if (!faqQ.trim() || !faqA.trim()) return;
    setFaq((f) => [...f, { q: faqQ.trim(), a: faqA.trim() }]);
    setFaqQ("");
    setFaqA("");
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || images.length >= 5) return;
    setUploading(true);
    try {
      const url = await uploadShopAsset(userId, file);
      setImages((imgs) => [...imgs, url]);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadShopAsset(userId, file);
      setFileUrl(url);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const supabase = createClient();
    await supabase.from("products").insert({
      shop_id: shopId,
      name,
      description,
      category,
      price_cents: Math.round(parseFloat(price || "0") * 100),
      compare_price_cents: comparePrice ? Math.round(parseFloat(comparePrice) * 100) : null,
      highlights,
      faq,
      images,
      file_url: fileUrl,
    });

    setSaving(false);
    router.push("/dashboard/products");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="rounded-2xl border border-line bg-paper-dim p-6">
        <h2 className="text-sm font-semibold text-ink">ข้อมูลสินค้า</h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">ชื่อสินค้า *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="เช่น คอร์สเริ่มต้น Figma"
              className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">
                ราคา (บาท) *
              </label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                type="number"
                min="0"
                placeholder="199"
                className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">
                ราคาเดิม (ถ้ามี)
              </label>
              <input
                value={comparePrice}
                onChange={(e) => setComparePrice(e.target.value)}
                type="number"
                min="0"
                placeholder="399"
                className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">หมวดหมู่</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    category === c
                      ? "border-ink bg-ink text-paper"
                      : "border-line text-ink-soft hover:text-ink"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">รายละเอียด</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 5000))}
              rows={5}
              placeholder="อธิบายสินค้าของคุณ"
              className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
            />
            <p className="mt-1 text-right text-xs text-muted">{description.length} / 5,000</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-paper-dim p-6">
        <h2 className="text-sm font-semibold text-ink">ไฟล์สินค้า</h2>
        <p className="mt-1 text-xs text-muted">
          ไฟล์ดิจิทัลที่ลูกค้าจะได้รับหลังซื้อ — สูงสุด 1 ไฟล์
        </p>
        <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line bg-paper py-8 text-center text-xs text-muted hover:border-ink">
          {fileUrl ? "อัปโหลดแล้ว ✓ (คลิกเพื่อเปลี่ยน)" : "ลากไฟล์มาวางที่นี่ หรือ คลิกเพื่อเลือก"}
          <input type="file" onChange={handleFileUpload} className="hidden" />
        </label>
      </section>

      <section className="rounded-2xl border border-line bg-paper-dim p-6">
        <h2 className="text-sm font-semibold text-ink">รูปสินค้า</h2>
        <p className="mt-1 text-xs text-muted">อัปโหลดได้สูงสุด 5 รูป · รูปแรกจะเป็นภาพหน้าปก</p>

        <div className="mt-3 flex flex-wrap gap-3">
          {images.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt=""
              className="h-20 w-20 rounded-lg border border-line object-cover"
            />
          ))}
          {images.length < 5 && (
            <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line text-xs text-muted hover:border-ink">
              + เพิ่มรูป
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          )}
        </div>
        <p className="mt-2 text-xs text-muted">{images.length}/5</p>
      </section>

      <section className="rounded-2xl border border-line bg-paper-dim p-6">
        <h2 className="text-sm font-semibold text-ink">จุดเด่น</h2>
        <div className="mt-3 space-y-2">
          {highlights.map((h, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-paper px-3 py-2 text-sm text-ink">
              <span>{h}</span>
              <button
                type="button"
                onClick={() => setHighlights((hs) => hs.filter((_, idx) => idx !== i))}
                className="text-xs text-muted hover:text-ink"
              >
                ลบ
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={highlightDraft}
            onChange={(e) => setHighlightDraft(e.target.value)}
            placeholder='เช่น "100 prompts", "PDF + Notion"'
            className="flex-1 rounded-lg border border-line bg-paper px-3.5 py-2 text-sm text-ink outline-none focus:border-ink"
          />
          <button
            type="button"
            onClick={addHighlight}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-paper"
          >
            เพิ่ม
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-paper-dim p-6">
        <h2 className="text-sm font-semibold text-ink">คำถามที่พบบ่อย (FAQ)</h2>
        <div className="mt-3 space-y-2">
          {faq.map((f, i) => (
            <div key={i} className="rounded-lg bg-paper px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium text-ink">{f.q}</p>
                <button
                  type="button"
                  onClick={() => setFaq((fs) => fs.filter((_, idx) => idx !== i))}
                  className="text-xs text-muted hover:text-ink"
                >
                  ลบ
                </button>
              </div>
              <p className="mt-1 text-ink-soft">{f.a}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <input
            value={faqQ}
            onChange={(e) => setFaqQ(e.target.value)}
            placeholder="คำถาม"
            className="w-full rounded-lg border border-line bg-paper px-3.5 py-2 text-sm text-ink outline-none focus:border-ink"
          />
          <textarea
            value={faqA}
            onChange={(e) => setFaqA(e.target.value)}
            placeholder="คำตอบ"
            rows={2}
            className="w-full rounded-lg border border-line bg-paper px-3.5 py-2 text-sm text-ink outline-none focus:border-ink"
          />
          <button
            type="button"
            onClick={addFaq}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-paper"
          >
            เพิ่ม
          </button>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || uploading}
          className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-paper transition hover:opacity-85 disabled:opacity-60"
        >
          {saving ? "กำลังสร้าง..." : "สร้างสินค้า"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard/products")}
          className="text-sm text-muted hover:text-ink"
        >
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
