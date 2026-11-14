import { describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
import { getAdminContext, isPlatformAdminUser } from "./access";
const admin = { id: "admin", email: "phawit.boo@gmail.com", email_confirmed_at: "2026-01-01", app_metadata: { provider: "google" }, identities: [{ provider: "google" }] } as User;
describe("admin identity", () => {
  it("allows only confirmed server-verified Google admin email", () => {
    expect(isPlatformAdminUser(admin)).toBe(true);
    expect(isPlatformAdminUser({ ...admin, email: "other@gmail.com" })).toBe(false);
    expect(isPlatformAdminUser({ ...admin, email_confirmed_at: undefined })).toBe(false);
    expect(isPlatformAdminUser({ ...admin, app_metadata: {}, identities: [] })).toBe(false);
    expect(isPlatformAdminUser(null)).toBe(false);
  });
  it("does not accept forged user metadata", () => {
    expect(isPlatformAdminUser({ ...admin, email: "attacker@example.com", user_metadata: { email: admin.email, provider: "google", role: "admin" } })).toBe(false);
  });
  it("does not construct privileged client before authorization", async () => {
    mocks.admin.mockClear();
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getAdminContext()).rejects.toMatchObject({ status: 401 });
    expect(mocks.admin).not.toHaveBeenCalled();
    mocks.getUser.mockResolvedValue({ data: { user: admin }, error: new Error("expired") });
    await expect(getAdminContext()).rejects.toMatchObject({ status: 401 });
    expect(mocks.admin).not.toHaveBeenCalled();
  });
});
