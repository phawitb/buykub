"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ClosingCTA({ ctaHref = "/login" }: { ctaHref?: string }) {
  const router = useRouter();
  const [shopName, setShopName] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const slug = normalizeSlug(shopName);
    if (!slug) return;
    const settingsPath = `/dashboard/settings?slug=${slug}`;
    router.push(
      ctaHref === "/login"
        ? `/login?next=${encodeURIComponent(settingsPath)}`
        : settingsPath,
    );
  }

  return (
    <section className="border-t border-line py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          พร้อมเริ่มขายหรือยัง?
        </h2>
        <p className="mt-3 text-ink-soft">
          สมัครฟรี ตั้งร้านในไม่กี่นาที แปะลิงก์ใน bio แล้วเริ่มมีรายได้
        </p>
        <form
          onSubmit={submit}
          className="mx-auto mt-8 flex max-w-md items-center rounded-full border border-line bg-paper p-1.5 pl-5 shadow-sm transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20"
        >
          <span className="shrink-0 text-sm font-semibold text-muted">
            framelink.app/
          </span>
          <input
            data-composite-input
            value={shopName}
            onChange={(event) => setShopName(event.target.value)}
            aria-label="ชื่อร้านของคุณ"
            placeholder="ชื่อร้านของคุณ"
            className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-ink outline-none focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={!normalizeSlug(shopName)}
            className="shrink-0 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45"
          >
            เปิดร้านเลย
          </button>
        </form>
        <p className="mt-3 text-xs text-muted">ใช้เวลาไม่ถึง 2 นาที</p>
      </div>
    </section>
  );
}
