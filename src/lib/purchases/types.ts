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
};
