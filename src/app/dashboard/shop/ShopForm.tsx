"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Shop = { id: string | null; slug: string; name: string; bio: string | null };

export function ShopForm({ initial }: { initial: Shop }) {
  const router = useRouter();
  const [slug, setSlug] = useState(initial.slug);
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error: dbError } = await supabase.from("shops").upsert(
      {
        id: initial.id ?? undefined,
        owner_id: user.id,
        slug,
        name,
        bio,
      },
      { onConflict: "id" },
    );

    setSaving(false);
    if (dbError) {
      setError(dbError.message.includes("duplicate") ? "ลิงก์นี้ถูกใช้แล้ว" : dbError.message);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-ink-soft">ชื่อร้าน</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
          placeholder="เช่น กัญญา — สอนออกแบบกราฟิก"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-ink-soft">
          ลิงก์ร้าน (framelink.app/…)
        </label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          required
          className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
          placeholder="kanya"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-ink-soft">คำอธิบายร้าน</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
          placeholder="บอกลูกค้าว่าร้านคุณขายอะไร"
        />
      </div>

      {error && <p className="text-xs text-ink-soft">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-paper transition hover:opacity-85 disabled:opacity-60"
      >
        {saving ? "กำลังบันทึก..." : "บันทึก"}
      </button>
    </form>
  );
}
