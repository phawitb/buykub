import { beforeEach, describe, expect, it, vi } from "vitest";

const createSupabaseClient = vi.fn(() => ({ from: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createSupabaseClient,
}));

describe("createPublicClient", () => {
  beforeEach(() => {
    vi.resetModules();
    createSupabaseClient.mockClear();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  });

  it("creates a cookie-independent client that never refreshes a visitor session", async () => {
    const { createPublicClient } = await import("@/lib/supabase/public");

    createPublicClient();

    expect(createSupabaseClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "anon-key",
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );
  });
});
