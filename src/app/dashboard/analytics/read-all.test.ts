import { describe, expect, it, vi } from "vitest";
import { readAllRows } from "./read-all";

describe("complete analytics datasets", () => {
  it("fetches disjoint pages so orders beyond the API row cap contribute exactly once", async () => {
    const dataset = Array.from({ length: 1002 }, (_, id) => ({ id }));
    const readPage = vi.fn(async (from: number, to: number) => ({ data: dataset.slice(from, to + 1), error: null }));
    const rows = await readAllRows(readPage);
    expect(rows).toHaveLength(1002);
    expect(rows[1001]).toEqual({ id: 1001 });
    expect(new Set(rows.map(({ id }) => id)).size).toBe(1002);
    expect(readPage.mock.calls).toEqual([[0, 999], [1000, 1999]]);
  });

  it("fails instead of returning an incomplete balance if a later page fails", async () => {
    const readPage = vi.fn()
      .mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, id) => ({ id })), error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("page unavailable") });
    await expect(readAllRows(readPage)).rejects.toThrow("page unavailable");
  });
});
