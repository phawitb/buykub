import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";

const navItems = [
  { href: "/dashboard", label: "หน้าแรก" },
  { href: "/dashboard/products", label: "สินค้า" },
  { href: "/dashboard/bookings", label: "จองบริการ" },
  { href: "/dashboard/orders", label: "ออเดอร์" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/settings", label: "ตั้งค่า" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-paper-dim px-5 py-6 sm:flex">
        <Link href="/" className="mb-10 text-lg font-bold tracking-tight text-ink">
          FRAME<span className="text-muted">LINK</span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-paper hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/dashboard/settings"
          className="mb-4 flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-2 text-xs"
        >
          <span className="font-medium text-ink-soft">แพลนปัจจุบัน</span>
          <span className="rounded-full bg-paper-dim px-2 py-0.5 font-semibold text-ink">
            Free
          </span>
        </Link>

        <div className="flex items-center gap-3 border-t border-line pt-4">
          {user.user_metadata?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.user_metadata.avatar_url}
              alt=""
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-ink" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-ink">
              {user.user_metadata?.full_name ?? user.email}
            </p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex-1 bg-paper px-6 py-8 sm:px-10">{children}</div>
    </div>
  );
}
