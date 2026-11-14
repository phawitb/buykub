import type { ReactNode } from "react";

export function ProductGrid({ children }: { children: ReactNode }) {
  return (
    <div
      role="list"
      aria-label="สินค้าดิจิทัล"
      className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
    >
      {children}
    </div>
  );
}
