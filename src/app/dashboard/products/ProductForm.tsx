"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ProductForm({ shopId }: { shopId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [kind, setKind] = useState<"digital" | "booking">("digital");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const supabase = createClient();
    await supabase.from("products").insert({
      shop_id: shopId,
      name,
      description,
      price_cents: Math.round(parseFloat(price || "0") * 100),
      kind,
    });

    setSaving(false);
    setName("");
    setDescription("");
    setPrice("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-soft">ชื่อสินค้า</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
            placeholder="เช่น คอร์สเริ่มต้น Figma"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-soft">ราคา (บาท)</label>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            type="number"
            min="0"
            step="1"
            className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
            placeholder="990"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-ink-soft">รายละเอียด</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
          placeholder="อธิบายสินค้าสั้นๆ"
        />
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="radio"
            checked={kind === "digital"}
            onChange={() => setKind("digital")}
          />
          สินค้าดิจิทัล
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="radio"
            checked={kind === "booking"}
            onChange={() => setKind("booking")}
          />
          บริการจอง
        </label>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-paper transition hover:opacity-85 disabled:opacity-60"
      >
        {saving ? "กำลังเพิ่ม..." : "เพิ่มสินค้า"}
      </button>
    </form>
  );
}
