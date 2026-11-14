import Link from "next/link";
import { ArrowRightIcon } from "./icons";

/**
 * Split hero: copy on the left over the paper ground, photograph bleeding off
 * the right edge. Title and subtitle still come from site settings so an admin
 * edit keeps driving this page.
 */
export function Hero({
  ctaHref = "/login",
  title = "ลงสินค้าแล้ว\nรอรับเงินได้เลย",
  subtitle = "ระบบยืนยันเงินเข้า ส่งของ และเปิดสิทธิ์ให้ลูกค้าเองทุกออเดอร์ คุณไม่ต้องนั่งเช็กสลิป ไม่ต้องส่งไฟล์เอง ไม่ต้องกดอะไรเลย",
}: {
  ctaHref?: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className="bg-paper">
      {/* Two real columns rather than a negative-margin bleed: the percentage
          in `calc((100% - 100vw) / 2)` resolves against this column, not the
          page shell, which pushed the layout 236px past the viewport. */}
      <div className="grid lg:grid-cols-2 lg:items-stretch lg:pt-10">
        <div className="flex items-center px-6 py-16 lg:justify-end lg:py-20 lg:pl-10 lg:pr-12">
          <div className="w-full lg:max-w-[34rem]" data-enter>
          <h1 className="text-[2.5rem] font-semibold leading-[1.1] text-ink sm:text-[3.25rem] lg:text-[3.5rem]">
            {title.split("\n").map((line, index) => (
              <span key={index} className="block">
                {line}
              </span>
            ))}
          </h1>

          <p className="measure mt-5 text-lg leading-8 text-ink-soft">{subtitle}</p>

          <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Link
              href={ctaHref}
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-accent pl-7 pr-6 text-[15px] font-medium text-on-ink transition duration-[120ms] ease-out hover:bg-accent-hover active:scale-[0.98]"
            >
              เปิดร้านฟรี
              <ArrowRightIcon className="size-4 transition-transform duration-[200ms] ease-out group-hover:translate-x-1" />
            </Link>
            <Link
              href="#how"
              className="draw-link text-[15px] font-medium text-ink-soft transition-colors hover:text-ink"
            >
              ดูวิธีใช้งาน
            </Link>
          </div>

          <p className="mt-12 border-t border-line pt-5 text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
            Your store. Your ideas. Your business.
          </p>
          </div>
        </div>

        <div className="relative mx-6 h-64 overflow-hidden rounded-container sm:h-80 lg:mx-0 lg:h-full lg:min-h-[clamp(480px,42vw,600px)] lg:rounded-r-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/landing/hero.webp"
            alt="ผู้ชายสวมแว่นกำลังพิมพ์งานบนโน้ตบุ๊กที่โต๊ะทำงาน"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}
