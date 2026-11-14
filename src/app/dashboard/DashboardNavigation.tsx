"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sellerItems = [
  { href: "/dashboard/products", label: "ร้านค้าของฉัน", icon: "product" },
  { href: "/learn", label: "รายการที่สั่งซื้อ", icon: "order" },
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
      {name === "course" && <><path {...common} d="M12 5C9 3 5 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-6-1-9 1ZM12 5v15" /></>}
      {name === "order" && <><rect {...common} x="4" y="3" width="16" height="18" rx="2" /><path {...common} d="M8 8h8M8 12h8M8 16h5" /></>}
      {name === "analytics" && <><path {...common} d="M4 20V10M10 20V4M16 20v-7M22 20V7" /><path {...common} d="M2 20h21" /></>}
      {name === "settings" && <><circle {...common} cx="12" cy="12" r="3" /><path {...common} d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3h4v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>}
    </svg>
  );
}

export function DashboardNavigation({ mobile = false, hasShop, isAdmin = false }: { mobile?: boolean; hasShop: boolean; isAdmin?: boolean }) {
  const pathname = usePathname();
  const items = [...(hasShop ? sellerItems : [
    { href: "/learn", label: "รายการที่สั่งซื้อ", icon: "order" },
    { href: "/dashboard/products?create=1", label: "เปิดร้าน", icon: "product" },
  ]), ...(isAdmin ? [{ href: "/dashboard/admin", label: "แอดมิน", icon: "settings" }] : [])];

  return (
    <nav
      aria-label={mobile ? "เมนูหลักมือถือ" : "เมนูหลัก"}
      className={
        mobile
          ? (hasShop ? (isAdmin ? "grid grid-cols-5" : "grid grid-cols-4") : (isAdmin ? "grid grid-cols-3" : "grid grid-cols-2"))
          : "flex flex-1 flex-col gap-1"
      }
    >
      {items.map((item) => {
        const active = pathname.startsWith(item.href.split("?")[0]) ||
          (item.href === "/dashboard/analytics" && pathname.startsWith("/dashboard/orders"));
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
