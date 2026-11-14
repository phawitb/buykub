import Link from "next/link";
import { LandingAccount } from "./LandingAccount";
import { ProfileMenu } from "./ProfileMenu";
import { BrandLogo } from "./BrandLogo";

type NavUser = { name: string; avatarUrl: string | null };

/** Only links that resolve to something real. No invented category routes. */
const links = [
  { label: "วิธีใช้งาน", href: "#how" },
  { label: "สิ่งที่ขายได้", href: "#what" },
  { label: "ค่าธรรมเนียม", href: "#pricing" },
];

export function SiteNav({ user, liveAccount = false }: { user?: NavUser | null; liveAccount?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="shell flex h-[72px] items-center justify-between gap-6 px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 text-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={32} height={32} className="size-8 rounded-inner" />
            <BrandLogo className="text-xl" />
          </Link>

          <nav aria-label="หลัก" className="hidden items-center gap-1 lg:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-inner px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-dim hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {liveAccount ? (
            <LandingAccount />
          ) : user ? (
            <ProfileMenu name={user.name} avatarUrl={user.avatarUrl} />
          ) : (
            <>
              <Link
                href="/login"
                className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:inline-flex"
              >
                เข้าสู่ระบบ
              </Link>
              <Link
                href="/login?next=%2Fdashboard%2Fproducts%3Fcreate%3D1"
                className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-on-ink transition duration-[120ms] ease-out hover:bg-accent-hover active:scale-[0.97]"
              >
                เปิดร้านฟรี
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
