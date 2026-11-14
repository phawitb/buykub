export type SiteSettings = {
  hero_title: string;
  hero_subtitle: string;
  announcement: string;
  support_email: string;
};
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  hero_title: "แปะลิงก์\nขายได้เลย",
  hero_subtitle: "ร้านค้าออนไลน์ในลิงก์เดียว สำหรับครีเอเตอร์ไทย ไม่ต้องทำเว็บเอง ไม่ต้องใช้บัตรเครดิต รับเงินผ่านพร้อมเพย์ได้ทันที",
  announcement: "",
  support_email: "support@buykub.com",
};
export type AdminWorkspace = {
  overview: { users: number; shops: number; products: number; orders: number };
  users: { id: string; email: string | null; full_name: string | null; created_at: string; note: string; payout_hold: boolean }[];
  shops: { id: string; owner_id: string; name: string; slug: string; published: boolean; created_at: string; moderated: boolean }[];
  products: { id: string; shop_id: string; name: string; price_cents: number; published: boolean; created_at: string; moderated: boolean }[];
  audit: { id: number; actor_id: string; action: string; target_id: string | null; metadata: Record<string, unknown>; created_at: string }[];
  site: SiteSettings;
  pagination: { page: number; pageSize: number; hasMore: boolean };
  query: string;
};
