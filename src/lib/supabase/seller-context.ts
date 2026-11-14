import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isGoogleUser } from "@/lib/auth";
import { createClient } from "./server";

// React cache is scoped to one server render, never shared between visitors.
export const getSellerContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isGoogleUser(user)) redirect("/login?error=auth&reason=google_required");
  const { data: shop, error } = await supabase.from("shops")
    .select("id, name, slug, avatar_url").eq("owner_id", user.id).maybeSingle();
  if (error) throw error;
  return { supabase, user, shop };
});
