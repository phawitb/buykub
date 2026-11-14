"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, CheckIcon, CopyIcon } from "./icons";
import { productUrl } from "@/lib/brand";

/**
 * Every product carries its own link. These are the three real products in the
 * example shop with their real URLs — the copy buttons hand over something that
 * actually resolves, and nothing here mocks up a feature that does not exist.
 */
const SHOP = "buykub-store";

const PRODUCTS = [
  {
    slug: "study-sheet-free",
    kind: "ไฟล์",
    name: "ชีทสรุปการเรียน — ดาวน์โหลดฟรี",
    price: "฿0",
    image: "/images/landing/cat-ebook.webp",
    alt: "แท็บเล็ตวางคู่กับหนังสือบนโต๊ะ",
  },
  {
    slug: "study-system-course",
    kind: "คอร์ส",
    name: "คอร์สตัวอย่าง — จัดระบบการเรียน",
    price: "฿50",
    image: "/images/landing/panel-course.webp",
    alt: "ผู้หญิงกำลังถ่ายวิดีโอตัวเองด้วยกล้องในห้องนั่งเล่น",
  },
  {
    slug: "product",
    kind: "ไฟล์",
    name: "ชีทตัวอย่าง — ฝึกวางแผนการเรียน",
    price: "฿20",
    image: "/images/landing/cat-template.webp",
    alt: "แท็บเล็ตวางบนโต๊ะไม้",
  },
];

function LinkCard({ product }: { product: (typeof PRODUCTS)[number] }) {
  const [copied, setCopied] = useState(false);
  const url = productUrl(SHOP, product.slug);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <li className="flex flex-col rounded-container bg-paper p-4 shadow-lift-2">
      <div className="zoom-frame relative rounded-element bg-paper-dim">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image}
          alt={product.alt}
          loading="lazy"
          decoding="async"
          className="aspect-[4/3] w-full object-cover"
        />
        <span className="absolute left-2.5 top-2.5 rounded-full bg-paper/90 px-2.5 py-1 text-[10px] font-medium text-ink backdrop-blur">
          {product.kind}
        </span>
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-medium leading-6 text-ink">{product.name}</p>
        <p className="shrink-0 text-sm font-semibold text-ink" data-numeric>
          {product.price}
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate rounded-element bg-paper-dim px-3 py-2.5 font-mono text-xs text-ink-soft">
          {url.replace(/^https:\/\//, "")}
        </p>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? `คัดลอกลิงก์ ${product.name} แล้ว` : `คัดลอกลิงก์ ${product.name}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-element bg-accent text-on-ink transition duration-[120ms] ease-out hover:bg-accent-hover active:scale-95"
        >
          {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
        </button>
      </div>
    </li>
  );
}

export function PaymentLinkBand() {
  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="shell overflow-hidden rounded-page bg-[linear-gradient(135deg,#cfe0fa_0%,#dcd9fb_38%,#ecd6f6_68%,#fbdcea_100%)] px-6 py-16 sm:px-12 sm:py-20">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="max-w-xl text-[2rem] font-semibold leading-[1.15] text-ink sm:text-[2.75rem]">
            รับชำระเงินได้
            <br />
            โดยไม่ต้องเขียนโค้ด
          </h2>
          <p className="max-w-sm text-[15px] leading-8 text-ink-soft">
            ทุกสินค้ามีลิงก์ของตัวเอง คัดลอกไปวางในไบโอ โพสต์ หรือแชทได้ทันที
            ลูกค้ากดจ่ายแล้วรับของเอง
          </p>
        </div>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((product) => (
            <LinkCard key={product.slug} product={product} />
          ))}
        </ul>

        <Link
          href={`/${SHOP}`}
          className="group mt-10 inline-flex items-center gap-2 text-sm font-medium text-accent-text"
        >
          <span className="draw-link">เปิดร้านตัวอย่างที่ซื้อได้จริง</span>
          <ArrowRightIcon className="size-4 transition-transform duration-[200ms] ease-out group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
}
