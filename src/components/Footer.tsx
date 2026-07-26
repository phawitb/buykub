import Link from "next/link";
import { BrandLogo } from "./BrandLogo";

export function Footer() {
  return (
    <footer className="border-t border-line py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-xs text-muted sm:flex-row">
        <Link href="/" className="text-ink">
          <BrandLogo className="text-xs" />
        </Link>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/terms" className="hover:text-ink">
            เงื่อนไขการใช้บริการ
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            นโยบายความเป็นส่วนตัว
          </Link>
          <span>© 2026 Framelink</span>
        </div>
      </div>
    </footer>
  );
}
