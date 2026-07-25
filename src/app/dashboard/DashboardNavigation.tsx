"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "หน้าแรก", icon: "⌂", exact: true },
  { href: "/dashboard/products", label: "สินค้า", icon: "◇" },
  { href: "/dashboard/bookings", label: "จอง", icon: "□" },
  { href: "/dashboard/orders", label: "ออเดอร์", icon: "▣" },
  { href: "/dashboard/analytics", label: "สถิติ", icon: "⌁" },
  { href: "/dashboard/settings", label: "ตั้งค่า", icon: "⚙" },
];

export function DashboardNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={mobile ? "เมนูหลักมือถือ" : "เมนูหลัก"}
      className={
        mobile
          ? "grid grid-cols-6"
          : "flex flex-1 flex-col gap-1"
      }
    >
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              mobile
                ? `relative flex min-w-0 flex-col items-center gap-1 px-1 py-3 text-[10px] ${
                    active ? "text-accent" : "text-muted"
                  }`
                : `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-accent-soft text-accent"
                      : "text-ink-soft hover:bg-paper hover:text-ink"
                  }`
            }
          >
            <span aria-hidden="true" className={mobile ? "text-lg" : "text-base"}>
              {item.icon}
            </span>
            <span className="truncate">{item.label}</span>
            {mobile && active && (
              <span className="absolute bottom-0 h-0.5 w-6 rounded-full bg-accent" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
