import { describe, expect, it, vi } from "vitest";
import UpgradePage from "./page";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));

describe("UpgradePage", () => {
  it("redirects obsolete upgrade links back to settings", () => {
    UpgradePage();

    expect(redirect).toHaveBeenCalledWith("/dashboard/settings");
  });
});
