import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isGoogleUser } from "@/lib/auth";
import { PUBLIC_CATALOG_TAG } from "@/lib/storefront/tags";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Forbidden" }, { status: 403, headers });
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !isGoogleUser(user)) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
    const { data: shop, error } = await supabase.from("shops").select("id").eq("owner_id", user.id).maybeSingle();
    if (error) throw error;
    if (!shop) return Response.json({ error: "Forbidden" }, { status: 403, headers });
    // Covers old slugs as well as new ones after a rename; only public data.
    revalidateTag(PUBLIC_CATALOG_TAG, { expire: 0 });
    return Response.json({ revalidated: true }, { headers });
  } catch {
    return Response.json({ error: "Refresh unavailable" }, { status: 503, headers });
  }
}
