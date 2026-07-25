"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CalendarConnection } from "./CalendarConnection";
import { ShopImageUploader } from "./ShopImageUploader";

type Shop = {
  id: string | null;
  slug: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  accent_color: string;
  payout_method: "promptpay" | "bank";
  promptpay_id: string | null;
  bank_details: string | null;
};

const ACCENT_PRESETS = [
  { name: "Tangerine", value: "#f97316" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Rose", value: "#e11d48" },
  { name: "Blue", value: "#2563eb" },
  { name: "Emerald", value: "#059669" },
  { name: "Amber", value: "#d97706" },
  { name: "Pink", value: "#db2777" },
  { name: "Cyan", value: "#0891b2" },
];

export function SettingsForm({
  initial,
  userId,
  calendarConnected = false,
  connectedEmail = null,
}: {
  initial: Shop;
  userId: string;
  calendarConnected?: boolean;
  connectedEmail?: string | null;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(initial.slug);
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url);
  const [coverUrl, setCoverUrl] = useState(initial.cover_url);
  const [accentColor, setAccentColor] = useState(initial.accent_color);
  const [payoutMethod, setPayoutMethod] = useState(initial.payout_method);
  const [promptpayId, setPromptpayId] = useState(initial.promptpay_id ?? "");
  const [bankDetails, setBankDetails] = useState(initial.bank_details ?? "");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();
    const { error: dbError } = await supabase.from("shops").upsert(
      {
        id: initial.id ?? undefined,
        owner_id: userId,
        slug,
        name,
        bio,
        avatar_url: avatarUrl,
        cover_url: coverUrl,
        accent_color: accentColor,
        payout_method: payoutMethod,
        promptpay_id: promptpayId || null,
        bank_details: bankDetails || null,
      },
      { onConflict: "id" },
    );

    setSaving(false);
    if (dbError) {
      setError(dbError.message.includes("duplicate") ? "ลิงก์นี้ถูกใช้แล้ว" : dbError.message);
      return;
    }
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      router.refresh();
    }, 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="border-b border-line pb-8">
        <h2 className="text-sm font-semibold text-ink">ข้อมูลร้าน</h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">ชื่อร้าน</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="ชื่อร้านของคุณ"
              className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">URL ร้าน</label>
            <div className="flex items-center rounded-lg border border-line bg-paper px-3.5 focus-within:border-ink">
              <span className="text-sm text-muted">framelink.app/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                required
                placeholder="your-store"
                className="flex-1 bg-transparent py-2.5 text-sm text-ink outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">แนะนำร้าน</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
              rows={3}
              placeholder="บอกลูกค้าเกี่ยวกับร้านของคุณ..."
              className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
            />
            <p className="mt-1 text-right text-xs text-muted">{bio.length}/160</p>
          </div>
        </div>
      </section>

      <section className="border-b border-line pb-8">
        <h2 className="text-sm font-semibold text-ink">รูปร้าน</h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ShopImageUploader
            kind="avatar"
            userId={userId}
            value={avatarUrl}
            onUploaded={setAvatarUrl}
            onBusyChange={setAvatarUploading}
          />
          <ShopImageUploader
            kind="cover"
            userId={userId}
            value={coverUrl}
            onUploaded={setCoverUrl}
            onBusyChange={setCoverUploading}
          />
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-medium text-ink-soft">สี accent</label>
          <div className="flex flex-wrap gap-2">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                aria-label={preset.name}
                aria-pressed={accentColor === preset.value}
                onClick={() => setAccentColor(preset.value)}
                className={`h-9 w-9 rounded-full border-2 p-1 transition ${
                  accentColor === preset.value
                    ? "border-ink"
                    : "border-transparent hover:border-line"
                }`}
              >
                <span
                  className="block h-full w-full rounded-full"
                  style={{ backgroundColor: preset.value }}
                />
              </button>
            ))}
          </div>
          <input
            type="color"
            aria-label="ค่าสี accent"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            className="sr-only"
          />
        </div>
      </section>

      <CalendarConnection
        connected={calendarConnected}
        connectedEmail={connectedEmail}
      />

      <section className="border-b border-line pb-8">
        <h2 className="text-sm font-semibold text-ink">ข้อมูลรับเงิน</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
              payoutMethod === "promptpay"
                ? "border-accent bg-accent-soft"
                : "border-line bg-paper hover:border-ink"
            }`}
          >
            <input
              type="radio"
              name="payout-method"
              aria-label="PromptPay เบอร์/บัตรประชาชน"
              checked={payoutMethod === "promptpay"}
              onChange={() => setPayoutMethod("promptpay")}
              className="sr-only"
            />
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-sm font-bold text-accent"
            >
              ฿
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">
                PromptPay
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                เบอร์/บัตรประชาชน
              </span>
            </span>
          </label>
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
              payoutMethod === "bank"
                ? "border-accent bg-accent-soft"
                : "border-line bg-paper hover:border-ink"
            }`}
          >
            <input
              type="radio"
              name="payout-method"
              aria-label="โอนเข้าบัญชีธนาคาร ทุกธนาคารไทย"
              checked={payoutMethod === "bank"}
              onChange={() => setPayoutMethod("bank")}
              className="sr-only"
            />
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-sm text-accent"
            >
              ▤
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">
                โอนเข้าบัญชีธนาคาร
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                ทุกธนาคารไทย
              </span>
            </span>
          </label>
        </div>

        <div className="mt-4">
          {payoutMethod === "promptpay" ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">
                เลข PromptPay (เบอร์โทร/บัตรประชาชน)
              </label>
              <input
                value={promptpayId}
                onChange={(e) => setPromptpayId(e.target.value)}
                placeholder="08xxxxxxxx"
                className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">
                เลขบัญชีธนาคาร
              </label>
              <input
                value={bankDetails}
                onChange={(e) => setBankDetails(e.target.value)}
                placeholder="ธนาคาร · เลขบัญชี · ชื่อบัญชี"
                className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
              />
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-muted">
          ระบบจะโอนรายได้เข้าช่องทางนี้ทุกวันจันทร์ — แต่ละยอดขายเข้ารอบโอนหลังพ้นระยะรับประกันคืนเงิน 7 วัน
          (เวอร์ชันนี้เป็นข้อมูลสำหรับแสดงผลเท่านั้น ยังไม่เชื่อมระบบโอนเงินจริง)
        </p>
      </section>

      {error && <p className="text-xs text-ink-soft">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || avatarUploading || coverUploading}
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper transition hover:bg-accent-hover disabled:opacity-60"
        >
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>

        {saved && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-ink-soft">
            <span aria-hidden>✓</span> บันทึกสำเร็จ
          </span>
        )}
      </div>
    </form>
  );
}
