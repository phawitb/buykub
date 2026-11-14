import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const { getUser, createClient, redirect } = vi.hoisted(() => ({
  getUser: vi.fn(),
  createClient: vi.fn(),
  redirect: vi.fn((destination: string) => { throw new Error(`REDIRECT:${destination}`); }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("./GoogleButton", () => ({
  GoogleButton: ({ next }: { next: string }) => <button data-next={next}>Google</button>,
}));

const googleUser = { id: "seller", app_metadata: { provider: "google" } };
const page = (params: { next?: string | string[]; error?: string; reason?: string } = {}) =>
  LoginPage({ searchParams: Promise.resolve(params) });

describe("login session routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({ auth: { getUser } });
    getUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  it.each([undefined, "https://evil.example", "//evil.example", "/\\evil.example", ["/learn", "/dashboard"]].map(next => ({ next })))(
    "sends a verified Google user to My Shop for a missing or unsafe destination $next",
    async ({ next }) => {
      getUser.mockResolvedValue({ data: { user: googleUser }, error: null });
      await expect(page({ next })).rejects.toThrow("REDIRECT:/dashboard/products");
    },
  );

  it("preserves the intended purchase or shop creation destination", async () => {
    getUser.mockResolvedValue({ data: { user: googleUser }, error: null });
    await expect(page({ next: "/dashboard/products?create=1" })).rejects.toThrow("REDIRECT:/dashboard/products?create=1");
    await expect(page({ next: "/learn/course-1" })).rejects.toThrow("REDIRECT:/learn/course-1");
  });

  it("accepts a verified linked Google identity", async () => {
    getUser.mockResolvedValue({ data: { user: { app_metadata: { provider: "email" }, identities: [{ provider: "google" }] } }, error: null });
    await expect(page()).rejects.toThrow("REDIRECT:/dashboard/products");
  });

  it.each([
    { data: { user: null }, error: null },
    { data: { user: { app_metadata: { provider: "email" }, user_metadata: { provider: "google" } } }, error: null },
    { data: { user: googleUser }, error: new Error("Invalid session") },
  ])("keeps the Google sign-in screen for unverified sessions", async (result) => {
    getUser.mockResolvedValue(result);
    render(await page({ next: "/learn/course-1" }));
    expect(screen.getByRole("button", { name: "Google" })).toHaveAttribute("data-next", "/learn/course-1");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("keeps sign-in usable when session verification fails", async () => {
    getUser.mockRejectedValue(new Error("Network unavailable"));
    render(await page({ error: "auth", reason: "exchange" }));
    expect(screen.getByRole("button", { name: "Google" })).toBeInTheDocument();
    expect(screen.getByText(/ลิงก์เข้าสู่ระบบหมดอายุ/)).toBeInTheDocument();
  });

  it("verifies each request independently without carrying another user's session", async () => {
    getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    await expect(page()).rejects.toThrow("REDIRECT:/dashboard/products");
    render(await page());
    expect(screen.getByRole("button", { name: "Google" })).toBeInTheDocument();
    expect(createClient).toHaveBeenCalledTimes(2);
    expect(getUser).toHaveBeenCalledTimes(2);
  });
});
