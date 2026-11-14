import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleButton } from "./GoogleButton";

const { signInWithOAuth, createClient } = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient }));

describe("GoogleButton", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createClient.mockReturnValue({ auth: { signInWithOAuth } });
  });

  afterEach(() => vi.useRealTimers());

  it("shows an error and allows retry when OAuth returns an error", async () => {
    signInWithOAuth.mockResolvedValue({
      data: { provider: "google", url: null },
      error: new Error("Provider unavailable"),
    });
    render(<GoogleButton next="/dashboard/settings" />);
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("alert")).not.toBeEmptyDOMElement();
    expect(screen.getByRole("button")).toBeEnabled();

    signInWithOAuth.mockReturnValue(new Promise(() => {}));
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it.each(["client", "request"])("recovers when the %s throws", async (stage) => {
    if (stage === "client") createClient.mockImplementation(() => { throw new Error("Missing configuration"); });
    else signInWithOAuth.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<GoogleButton next="/dashboard" />);
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("alert")).not.toBeEmptyDOMElement();
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it.each(["pending request", "blocked redirect"])("recovers from a %s instead of staying disabled", async (failure) => {
    vi.useFakeTimers();
    if (failure === "pending request") signInWithOAuth.mockReturnValue(new Promise(() => {}));
    else signInWithOAuth.mockResolvedValue({
      data: { provider: "google", url: "https://example.com/oauth" },
      error: null,
    });
    render(<GoogleButton next="/dashboard/settings" />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toBeDisabled();
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=%2Fdashboard%2Fsettings` },
    });
    await act(async () => vi.advanceTimersByTime(15000));
    expect(screen.getByRole("alert")).not.toBeEmptyDOMElement();
    expect(screen.getByRole("button")).toBeEnabled();
  });
});
