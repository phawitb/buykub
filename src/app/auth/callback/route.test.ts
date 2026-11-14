import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const exchangeCodeForSession = vi.fn();
const getUser = vi.fn();
const signOut = vi.fn();
const maybeSingle = vi.fn();
const upsert = vi.fn();
const from = vi.fn(() => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({ maybeSingle })),
  })),
  upsert,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession,
      getUser,
      signOut,
    },
    from,
  })),
}));

describe("OAuth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs in a Google user without storing Calendar tokens even from an old Calendar link", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          provider_token: "fresh-access-token",
          provider_refresh_token: null,
        },
      },
      error: null,
    });
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "owner@example.com",
          user_metadata: { full_name: "Owner" },
          app_metadata: { provider: "google" },
        },
      },
    });
    maybeSingle.mockResolvedValue({
      data: { google_provider_refresh_token: "existing-refresh-token" },
    });
    upsert.mockResolvedValue({ error: null });

    const response = await GET(
      new Request(
        "http://localhost:3011/auth/callback?code=oauth-code&calendar=1&next=%2Fdashboard%2Fsettings",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3011/dashboard/settings",
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-1",
        email: "owner@example.com",
      }),
      { onConflict: "id" },
    );
    expect(upsert.mock.calls[0][0]).not.toHaveProperty("google_provider_token");
    expect(upsert.mock.calls[0][0]).not.toHaveProperty("google_provider_refresh_token");
    expect(upsert.mock.calls[0][0]).not.toHaveProperty("google_calendar_connected_at");
  });

  it("rejects an email-only identity and clears only the current session", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });
    getUser.mockResolvedValue({ data: { user: {
      id: "email-user", app_metadata: { provider: "email" },
      user_metadata: { provider: "google" },
    } } });
    signOut.mockResolvedValue({ error: null });
    const response = await GET(new Request("http://localhost:3011/auth/callback?code=code&next=%2Flearn"));
    expect(response.headers.get("location")).toBe("http://localhost:3011/login?error=auth&reason=google_required&next=%2Flearn");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it.each(["//evil.example", "/\\evil.example", "https://evil.example"])("never redirects off-site for %s", async (next) => {
    exchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });
    getUser.mockResolvedValue({ data: { user: { id: "google-user", app_metadata: { provider: "google" } } } });
    const response = await GET(new Request(`http://localhost:3011/auth/callback?code=code&next=${encodeURIComponent(next)}`));
    expect(response.headers.get("location")).toBe("http://localhost:3011/dashboard/products");
  });

  it("preserves the intended destination and records the exchange failure", async () => {
    const callbackError = new Error("PKCE code verifier not found");
    exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: callbackError,
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await GET(
      new Request(
        "http://localhost:3011/auth/callback?code=oauth-code&next=%2Fdashboard%2Fsettings",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3011/login?error=auth&reason=exchange&next=%2Fdashboard%2Fsettings",
    );
    expect(consoleError).toHaveBeenCalledWith(
      "Supabase OAuth code exchange failed",
      callbackError,
    );
  });
});
