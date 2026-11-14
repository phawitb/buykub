import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), from: vi.fn(), selections: [] as { table: string; columns: string }[], ranges: [] as number[][] }));
vi.mock("./access", () => ({ getAdminContext: mocks.context }));
import { getAdminWorkspace } from "./service";
beforeEach(() => {
  mocks.selections.length = 0;
  mocks.ranges.length = 0;
  mocks.from.mockImplementation((table: string) => {
    let head = false;
    const builder = {
      select(columns: string, options?: { head?: boolean }) { mocks.selections.push({ table, columns }); head = Boolean(options?.head); return builder; },
      order: () => builder, range(start: number, end: number) { mocks.ranges.push([start, end]); return builder; },
      eq: () => builder, maybeSingle: () => builder, limit: () => builder, or: () => builder, ilike: () => builder, in: () => builder,
      then(resolve: (result: unknown) => unknown) {
        const data = table === "profiles" && !head ? Array.from({ length: 26 }, (_, i) => ({ id: `user-${i}`, email: "example@example.com", full_name: null, created_at: "2026-11-14" })) : table === "platform_site_settings" ? null : [];
        return Promise.resolve(resolve({ data, count: 100, error: null }));
      },
    };
    return builder;
  });
  mocks.context.mockResolvedValue({ user: { id: "admin" }, admin: { from: mocks.from } });
});
it("bounds pages and exposes only explicitly selected profile fields, never provider tokens", async () => {
  const result = await getAdminWorkspace({ page: 2, query: "seller" });
  expect(result.users).toHaveLength(25);
  expect(result.pagination).toEqual({ page: 2, pageSize: 25, hasMore: true });
  expect(mocks.ranges).toEqual([[25, 50], [25, 50], [25, 50]]);
  expect(mocks.selections.find(item => item.table === "profiles")?.columns).toBe("id,email,full_name,created_at");
  expect(mocks.selections.some(item => item.columns === "*" || item.columns.includes("token"))).toBe(false);
  expect(result.users[0].note).toBe("");
  expect(result.users[0].payout_hold).toBe(false);
});
it("does not query private tables when authorization fails", async () => {
  mocks.from.mockClear();
  mocks.context.mockRejectedValueOnce(new Error("Forbidden"));
  await expect(getAdminWorkspace()).rejects.toThrow("Forbidden");
  expect(mocks.from).not.toHaveBeenCalled();
});
