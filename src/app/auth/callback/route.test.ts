import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const exchangeCodeForSession = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession,
      getUser,
    },
  })),
}));

describe("OAuth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
