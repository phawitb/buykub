import { describe, expect, it } from "vitest";
import { safeAuthRedirect } from "../auth";

describe("login destination", () => {
  it.each([undefined, null, "", "/", "/dashboard", "https://evil.example", "//evil.example"])("opens My Shop for default or unsafe destination %s", (next) => {
    expect(safeAuthRedirect(next)).toBe("/dashboard/products");
  });
  it("keeps a specific classroom or creation destination", () => {
    expect(safeAuthRedirect("/learn/course-1")).toBe("/learn/course-1");
    expect(safeAuthRedirect("/dashboard/products?slug=hello")).toBe("/dashboard/products?slug=hello");
  });
  it.each(["/login", "/login?next=/learn", "/login/", "/shop/../login", "/%6Cogin", "/auth/callback?code=used", "/bad%"])("avoids an auth redirect loop or malformed destination %s", next => {
    expect(safeAuthRedirect(next)).toBe("/dashboard/products");
  });
});
