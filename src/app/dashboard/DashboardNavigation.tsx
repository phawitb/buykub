"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "หน้าแรก", icon: "home", exact: true },
  { href: "/dashboard/products", label: "สินค้า", icon: "product" },
  { href: "/dashboard/bookings", label: "จองบริการ", icon: "booking" },
  { href: "/dashboard/orders", label: "ออเดอร์", icon: "order" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "analytics" },
  { href: "/dashboard/settings", label: "ตั้งค่า", icon: "settings" },
];

function NavIcon({ name }: { name: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      {name === "home" && <><path {...common} d="m3 11 9-8 9 8" /><path {...common} d="M5.5 9.5V21h13V9.5M9 21v-6h6v6" /></>}
      {name === "product" && <><path {...common} d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" /><path {...common} d="m4 7.5 8 4.5 8-4.5V17l-8 4-8-4V7.5Z" /></>}
      {name === "booking" && <><rect {...common} x="3" y="5" width="18" height="16" rx="2" /><path {...common} d="M16 3v4M8 3v4M3 10h18" /></>}
      {name === "order" && <><rect {...common} x="4" y="3" width="16" height="18" rx="2" /><path {...common} d="M8 8h8M8 12h8M8 16h5" /></>}
      {name === "analytics" && <><path {...common} d="M4 20V10M10 20V4M16 20v-7M22 20V7" /><path {...common} d="M2 20h21" /></>}
      {name === "settings" && <><circle {...common} cx="12" cy="12" r="3" /><path {...common} d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3h4v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>}
    </svg>
  );
}

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
            <NavIcon name={item.icon} />
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
