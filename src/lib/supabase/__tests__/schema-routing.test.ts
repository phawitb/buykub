import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: vi.fn() }),
}));

describe("database schema routing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://schema-test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
    vi.stubGlobal("window", undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each([
    ["browser", "buykub"], ["server", "buykub"], ["public", "buykub"],
    ["browser", ""], ["server", ""], ["public", ""],
  ])("routes %s reads and writes with schema %s", async (kind, schema) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_DB_SCHEMA", schema);
    const profiles: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      const headers = new Headers(init?.headers);
      profiles.push(headers.get(init?.method === "POST" ? "content-profile" : "accept-profile") ?? "missing");
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    }));
    const clientModule = kind === "server"
      ? await import("../server")
      : kind === "public" ? await import("../public") : await import("../client");
    const client = "createPublicClient" in clientModule ? clientModule.createPublicClient() : await clientModule.createClient();
    await client.from("profiles").select("id");
    await client.from("profiles").insert({ id: "test-user" });
    expect(profiles).toEqual([schema || "public", schema || "public"]);
  });
});
