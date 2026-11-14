"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { findNewProductAssets, type ProductAsset } from "../asset-cleanup";
import type { ProductEditorValue, ProductKeyRecord } from "../model";

type Draft = { userId: string; value: ProductEditorValue; baseline: ProductEditorValue; keyRecords: ProductKeyRecord[] };

export function productDraftKey(userId: string, shopId: string, productId?: string) {
  return JSON.stringify([userId, shopId, productId ?? "new"]);
}

class ProductDraftStore {
  private drafts = new Map<string, Draft>();
  read(key: string) { return this.drafts.get(key); }
  save(key: string, draft: Draft) { this.drafts.set(key, draft); }
  clear(key: string) { this.drafts.delete(key); }
  assets(userId: string): ProductAsset[] {
    return [...this.drafts.values()].filter((draft) => draft.userId === userId)
      .flatMap((draft) => findNewProductAssets(draft.baseline, draft.value));
  }
}

const ProductDraftContext = createContext<ProductDraftStore | null>(null);

/** Lives with the products layout; draft text and keys never enter browser storage. */
export function ProductDraftProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new ProductDraftStore());
  return <ProductDraftContext.Provider value={store}>{children}</ProductDraftContext.Provider>;
}

export function useProductDrafts() { return useContext(ProductDraftContext); }
