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
