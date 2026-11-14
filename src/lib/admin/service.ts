import "server-only";
import { getAdminContext } from "./access";
import { DEFAULT_SITE_SETTINGS, type AdminWorkspace } from "./model";
import { parseAdminAction, parseSiteSettings } from "./validation";

export async function getAdminWorkspace(options: { page?: number; query?: string } = {}): Promise<AdminWorkspace> {
  const { admin } = await getAdminContext();
  const page = Math.max(1, Math.min(10000, Math.floor(Number(options.page) || 1)));
  const pageSize = 25;
  const query = (options.query ?? "").trim().slice(0, 100);
  // Exclude PostgREST filter punctuation/wildcards; query never becomes a column or operator.
  const filter = query.replace(/[^\p{L}\p{N}@ ._\-]/gu, "").replace(/[_%]/g, "");
  const start = (page - 1) * pageSize;
  let usersQuery = admin.from("profiles").select("id,email,full_name,created_at").order("created_at", { ascending: false }).order("id").range(start, start + pageSize);
  let shopsQuery = admin.from("shops").select("id,owner_id,name,slug,published,created_at").order("created_at", { ascending: false }).order("id").range(start, start + pageSize);
  let productsQuery = admin.from("products").select("id,shop_id,name,price_cents,published,created_at").order("created_at", { ascending: false }).order("id").range(start, start + pageSize);
  if (filter) {
    usersQuery = usersQuery.or(`email.ilike.%${filter}%,full_name.ilike.%${filter}%`);
    shopsQuery = shopsQuery.or(`name.ilike.%${filter}%,slug.ilike.%${filter}%`);
    productsQuery = productsQuery.ilike("name", `%${filter}%`);
  }
  const [users, shops, products, audit, site, userCount, shopCount, productCount, orderCount] = await Promise.all([
    usersQuery, shopsQuery, productsQuery,
    admin.from("admin_audit_log").select("id,actor_id,action,target_id,metadata,created_at").order("created_at", { ascending: false }).limit(50),
    admin.from("platform_site_settings").select("hero_title,hero_subtitle,announcement,support_email").eq("id", true).maybeSingle(),
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("shops").select("id", { count: "exact", head: true }),
    admin.from("products").select("id", { count: "exact", head: true }),
    admin.from("orders").select("id", { count: "exact", head: true }),
  ]);
  for (const result of [users, shops, products, audit, site, userCount, shopCount, productCount, orderCount]) if (result.error) throw new Error("Admin data is unavailable");
  const userRows = (users.data ?? []).slice(0, pageSize);
  const shopRows = (shops.data ?? []).slice(0, pageSize);
  const productRows = (products.data ?? []).slice(0, pageSize);
  const [userControls, contentControls] = await Promise.all([
    userRows.length ? admin.from("admin_user_controls").select("user_id,note,payout_hold").in("user_id", userRows.map(row => row.id)) : Promise.resolve({ data: [], error: null }),
    shopRows.length + productRows.length ? admin.from("admin_content_controls").select("target_kind,target_id,hidden").in("target_id", [...shopRows, ...productRows].map(row => row.id)) : Promise.resolve({ data: [], error: null }),
  ]);
  if (userControls.error || contentControls.error) throw new Error("Admin controls are unavailable");
  return {
    overview: { users: userCount.count ?? 0, shops: shopCount.count ?? 0, products: productCount.count ?? 0, orders: orderCount.count ?? 0 },
    users: userRows.map(row => ({ ...row, note: userControls.data?.find(c => c.user_id === row.id)?.note ?? "", payout_hold: userControls.data?.find(c => c.user_id === row.id)?.payout_hold ?? false })),
    shops: shopRows.map(row => ({ ...row, moderated: contentControls.data?.some(c => c.target_kind === "shop" && c.target_id === row.id && c.hidden) ?? false })),
    products: productRows.map(row => ({ ...row, moderated: contentControls.data?.some(c => c.target_kind === "product" && c.target_id === row.id && c.hidden) ?? false })),
    audit: audit.data ?? [],
    site: site.data ? parseSiteSettings(site.data) : { ...DEFAULT_SITE_SETTINGS },
    pagination: { page, pageSize, hasMore: [users, shops, products].some(result => (result.data?.length ?? 0) > pageSize) }, query,
  };
}
export async function applyAdminAction(action: string, body: unknown) {
  const { admin, user } = await getAdminContext();
  const input = parseAdminAction(action, body);
  const payload = input.action === "save-site" ? input.settings : input;
  const { error } = await admin.rpc("admin_apply_action", { p_actor: user.id, p_action: input.action, p_payload: payload });
  if (error) throw new Error("ไม่สามารถบันทึกได้ โปรดตรวจสอบข้อมูลและลองอีกครั้ง");
  return input.action;
}
