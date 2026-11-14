"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import type { ReactNode } from "react";
import { ProductDraftProvider } from "@/features/products/components/ProductDraftProvider";

export default function ProductsLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  // The children segment stays at the storefront during intercepted navigation.
  const segment = useSelectedLayoutSegment();
  return <ProductDraftProvider>
    <div className={segment ? "px-5 py-7 sm:px-10 sm:py-9" : undefined}>{children}</div>
    {modal}
  </ProductDraftProvider>;
}
