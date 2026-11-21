import { describe, expect, it, vi } from "vitest";
import {
  isMissingColumnError,
  withoutColumn,
  writeWithoutMissingColumn,
} from "@/lib/supabase/missing-column";

const selectError = {
  code: "42703",
  message: "column products.file_page_count does not exist",
};
const writeError = {
  code: "PGRST204",
  message: "Could not find the 'file_page_count' column of 'products' in the schema cache",
};

describe("isMissingColumnError", () => {
  it("recognizes the column a migration has not created yet", () => {
    expect(isMissingColumnError(selectError, "file_page_count")).toBe(true);
    expect(isMissingColumnError(writeError, "file_page_count")).toBe(true);
  });

  it("does not take some other failure for a missing column", () => {
    expect(isMissingColumnError({ code: "42703", message: "column products.slug does not exist" }, "file_page_count")).toBe(false);
    expect(isMissingColumnError({ code: "23505", message: "file_page_count" }, "file_page_count")).toBe(false);
    expect(isMissingColumnError(new Error("network"), "file_page_count")).toBe(false);
    expect(isMissingColumnError(null, "file_page_count")).toBe(false);
  });
});

describe("withoutColumn", () => {
  it("leaves the rest of the row untouched", () => {
    expect(withoutColumn({ name: "Guide", file_page_count: 42 }, "file_page_count")).toEqual({
      name: "Guide",
    });
  });
});

describe("writeWithoutMissingColumn", () => {
  it("writes the whole row when the database has the column", async () => {
    const run = vi.fn(async () => "saved");

    await expect(
      writeWithoutMissingColumn({ name: "Guide", file_page_count: 42 }, "file_page_count", run),
    ).resolves.toBe("saved");
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith({ name: "Guide", file_page_count: 42 });
  });

  it("saves the product anyway when the column is not there yet", async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(writeError)
      .mockResolvedValueOnce("saved");

    await expect(
      writeWithoutMissingColumn({ name: "Guide", file_page_count: 42 }, "file_page_count", run),
    ).resolves.toBe("saved");
    expect(run).toHaveBeenLastCalledWith({ name: "Guide" });
  });

  it("lets every other failure reach the seller", async () => {
    const run = vi.fn().mockRejectedValue(new Error("เครือข่ายล่ม"));

    await expect(
      writeWithoutMissingColumn({ name: "Guide" }, "file_page_count", run),
    ).rejects.toThrow("เครือข่ายล่ม");
    expect(run).toHaveBeenCalledTimes(1);
  });
});
