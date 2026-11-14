import { beforeEach, describe, expect, it, vi } from "vitest";

const createSupabaseClient = vi.fn(() => ({ from: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createSupabaseClient,
}));

describe("createPublicClient", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_DB_SCHEMA", "public");
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
        db: { schema: "public" },
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
          storageKey: "framelink-public-anon",
        },
      },
    );
  });

  it("reuses one anonymous auth client in the same runtime", async () => {
    const { createPublicClient } = await import("@/lib/supabase/public");

    const first = createPublicClient();
    const second = createPublicClient();

    expect(second).toBe(first);
    expect(createSupabaseClient).toHaveBeenCalledOnce();
  });

  it("does not reuse a request client in the server runtime", async () => {
    vi.stubGlobal("window", undefined);
    const { createPublicClient } = await import("@/lib/supabase/public");

    const first = createPublicClient();
    const second = createPublicClient();

    expect(second).not.toBe(first);
    expect(createSupabaseClient).toHaveBeenCalledTimes(2);
    expect(createSupabaseClient).toHaveBeenLastCalledWith(
      "https://project.supabase.co",
      "anon-key",
      {
        db: { schema: "public" },
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );
  });
});
