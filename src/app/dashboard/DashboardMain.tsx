"use client";

import { usePathname } from "next/navigation";

/** Product routes own their spacing so an intercepted editor keeps its storefront full width. */
export function DashboardMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const storefront = pathname === "/dashboard/products" || pathname.startsWith("/dashboard/products/");
  return <main className={storefront
    ? "min-w-0 flex-1 bg-paper pb-24 sm:pb-0"
    : "min-w-0 flex-1 bg-paper px-5 py-7 pb-28 sm:px-10 sm:py-9 sm:pb-9"}>
    {children}
  </main>;
}
