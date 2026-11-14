import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SITE_SETTINGS } from "./model";
import { parseSiteSettings } from "./validation";
export const PUBLIC_SITE_SETTINGS_TAG = "platform-site-settings";
/** The only privileged data allowed in this public cache is these four plain text fields. */
export const getPublicSiteSettings = unstable_cache(async () => {
  try {
    const { data, error } = await createAdminClient().from("platform_site_settings")
      .select("hero_title,hero_subtitle,announcement,support_email").eq("id", true).maybeSingle();
    if (error || !data) return { ...DEFAULT_SITE_SETTINGS };
    return parseSiteSettings(data);
  } catch { return { ...DEFAULT_SITE_SETTINGS }; }
}, ["public-site-settings-v1", process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "buykub"], { revalidate: 60, tags: [PUBLIC_SITE_SETTINGS_TAG] });
