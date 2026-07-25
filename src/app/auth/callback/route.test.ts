import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const exchangeCodeForSession = vi.fn();
const getUser = vi.fn();
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
    },
    from,
  })),
}));

describe("OAuth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the existing Google refresh token when reconnect omits a new one", async () => {
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
        google_provider_token: "fresh-access-token",
        google_provider_refresh_token: "existing-refresh-token",
        google_calendar_connected_at: expect.any(String),
      }),
      { onConflict: "id" },
    );
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
