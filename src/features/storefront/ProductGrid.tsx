import type { ReactNode } from "react";

export function ProductGrid({ children }: { children: ReactNode }) {
  return (
    <div
      role="list"
      aria-label="สินค้าดิจิทัล"
      className="grid grid-cols-1 gap-x-3 gap-y-7 sm:grid-cols-2 sm:gap-x-4"
    >
      {children}
    </div>
  );
}
