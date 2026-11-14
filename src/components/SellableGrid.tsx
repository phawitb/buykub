import Link from "next/link";
import { ArrowRightIcon } from "./icons";
import { BRAND_NAME } from "@/lib/brand";

/**
 * What a seller can actually put in a shop. Each entry maps to a delivery type
 * the product editor really supports — file, course or product key — so nothing
 * here promises a format the platform cannot deliver.
 */
const sellables = [
  { label: "E-book และชีท", image: "/images/landing/cat-ebook.webp", alt: "แท็บเล็ตวางคู่กับหนังสือบนโต๊ะ" },
  { label: "คอร์สออนไลน์", image: "/images/landing/panel-course.webp", alt: "ผู้หญิงกำลังถ่ายวิดีโอตัวเองด้วยกล้องในห้องนั่งเล่น" },
  { label: "เทมเพลตและพรีเซ็ต", image: "/images/landing/cat-template.webp", alt: "แท็บเล็ตวางบนโต๊ะไม้" },
  { label: "คีย์สินค้า", image: "/images/landing/cat-key.webp", alt: "จอยเกมและกล่องเกมวางบนโต๊ะ" },
];

export function SellableGrid({ ctaHref }: { ctaHref: string }) {
  return (
    <section id="what" className="bg-paper py-20 sm:py-24">
      <div className="shell px-6">
        <h2 className="text-center text-3xl text-ink sm:text-[2.25rem]">
          ทุกสิ่งที่คุณสร้าง ขายได้ที่{" "}
          <span className="font-semibold text-accent-text">{BRAND_NAME}</span>
        </h2>

        <ul className="mt-12 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {sellables.map((item) => (
            <li key={item.label}>
              <Link href={ctaHref} className="group block">
                <div className="zoom-frame rounded-container bg-paper-dim">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image}
                    alt={item.alt}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[4/3] w-full object-cover"
                  />
                </div>
                <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-ink">
                  {item.label}
                  <ArrowRightIcon className="size-4 text-muted transition-transform duration-[200ms] ease-out group-hover:translate-x-1 group-hover:text-accent-text" />
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
