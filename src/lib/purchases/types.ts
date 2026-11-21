export type Purchase = {
  id: string;
  name: string;
  shopName: string;
  kind: "course" | "file" | "key" | "other";
  priceCents: number;
  purchasedAt: string;
  status: "paid" | "pending" | "refunded" | "expired" | "unavailable";
  expiresAt: string | null;
  href: string | null;
  /** Exam-prep courses only: distinct questions attempted out of the whole bank. */
  progress?: PurchaseProgress | null;
};

export type PurchaseProgress = { answered: number; total: number };

/** A product of the signed-in seller's own shop, opened the way a buyer would. */
export type ShopTryout = {
  id: string;
  name: string;
  kind: "course" | "file" | "key";
  published: boolean;
  /** The product's first public image, as the storefront card shows it. */
  coverUrl: string | null;
  /** null when there is nothing to open yet, such as a file product without its file. */
  href: string | null;
  progress?: PurchaseProgress | null;
};
