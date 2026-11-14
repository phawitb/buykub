"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon } from "./icons";

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
    const settingsPath = `/dashboard/products?slug=${slug}`;
    router.push(
      ctaHref === "/login"
        ? `/login?next=${encodeURIComponent(settingsPath)}`
        : settingsPath,
    );
  }

  return (
    <section className="bg-paper py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl text-ink sm:text-[2.25rem]">
          เริ่มต้นสร้างร้านของคุณวันนี้
        </h2>
        <p className="mt-4 text-base leading-7 text-ink-soft">
          เปิดร้านฟรี ไม่มีรายเดือน ค่าธรรมเนียมเพียง 5% ต่อออเดอร์
        </p>
        <form
          onSubmit={submit}
          className="mx-auto mt-9 flex h-14 max-w-md items-center rounded-full border border-line bg-paper p-1.5 pl-5 transition duration-[200ms] ease-out focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20"
        >
          <span className="shrink-0 text-sm font-medium text-muted">
            buykub.com/
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
            className="group inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-accent pl-5 pr-4 text-sm font-medium text-on-ink transition duration-[120ms] ease-out hover:bg-accent-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100"
          >
            เปิดร้านเลย
            <ArrowRightIcon className="size-3.5 transition-transform duration-[200ms] ease-out group-hover:translate-x-0.5 group-disabled:translate-x-0" />
          </button>
        </form>
        <p className="mt-4 text-xs text-muted">ใช้เวลาไม่ถึง 2 นาที</p>
      </div>
    </section>
  );
}
