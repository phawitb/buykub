import Link from "next/link";
import { BrandLogo } from "./BrandLogo";

const links = [
  { label: "วิธีใช้งาน", href: "/#how" },
  { label: "สิ่งที่ขายได้", href: "/#what" },
  { label: "ค่าธรรมเนียม", href: "/#pricing" },
  { label: "เงื่อนไขการใช้บริการ", href: "/terms" },
  { label: "นโยบายความเป็นส่วนตัว", href: "/privacy" },
];

/**
 * The reference design carried YouTube, Facebook and LINE icons. BUYKUB has no
 * accounts on those, and an icon linking nowhere — or to someone else's page —
 * is worse than no icon, so the row is left out until there is something real
 * to point at. The configured support address is the one contact that exists.
 */
export function Footer({ supportEmail }: { supportEmail?: string } = {}) {
  return (
    <footer className="mt-auto border-t border-line bg-paper">
      <div className="shell flex flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="flex items-center gap-2.5 text-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={28} height={28} className="size-7 rounded-inner" />
          <BrandLogo className="text-lg" />
        </Link>

        <nav aria-label="ลิงก์ท้ายเว็บ" className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="draw-link text-sm text-muted transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="shell flex flex-col gap-2 px-6 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          {supportEmail && (
            <a href={`mailto:${supportEmail}`} className="draw-link hover:text-ink">
              {supportEmail}
            </a>
          )}
          <span>© 2026 BUYKUB. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
