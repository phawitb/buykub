import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let publicClient: SupabaseClient | undefined;

function buildPublicClient(browserRuntime: boolean) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
        ...(browserRuntime ? { storageKey: "framelink-public-anon" } : {}),
      },
    },
  );
}

export function createPublicClient() {
  if (typeof window === "undefined") return buildPublicClient(false);
  publicClient ??= buildPublicClient(true);
  return publicClient;
}
