import "server-only";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export class AdminAccessError extends Error {
  constructor(public readonly status: 401 | 403) { super(status === 401 ? "Unauthorized" : "Forbidden"); }
}
/** Input MUST come from Supabase auth.getUser(), never client claims or metadata. */
export function isPlatformAdminUser(user: User | null | undefined): user is User {
  return Boolean(user && user.email?.toLowerCase() === "phawit.boo@gmail.com" && user.email_confirmed_at &&
    (user.app_metadata?.provider === "google" || user.identities?.some(identity => identity.provider === "google")));
}
export async function getAdminContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AdminAccessError(401);
  if (!isPlatformAdminUser(user)) throw new AdminAccessError(403);
  return { user, admin: createAdminClient() };
}
export async function requireAdmin() {
  try { return await getAdminContext(); }
  catch (error) {
    if (error instanceof AdminAccessError) redirect(error.status === 401 ? "/login?next=/dashboard/admin" : "/dashboard/products");
    throw error;
  }
}
