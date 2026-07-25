import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSettingsDraft,
  readSettingsDraft,
  writeSettingsDraft,
  type SettingsDraft,
} from "./settings-draft";

const draft: SettingsDraft = {
  slug: "draft-shop",
  name: "Draft shop",
  bio: "Unsaved description",
  avatarUrl: "https://example.com/avatar.jpg",
  coverUrl: null,
  accentColor: "#7c3aed",
  payoutMethod: "bank",
  promptpayId: "",
  bankDetails: "Example Bank\n1234567890\nOwner",
};

describe("settings draft storage", () => {
  beforeEach(() => sessionStorage.clear());

  it("round-trips a draft for the same user only", () => {
    writeSettingsDraft("user-1", draft);

    expect(readSettingsDraft("user-1")).toEqual(draft);
    expect(readSettingsDraft("user-2")).toBeNull();
  });

  it("ignores malformed storage", () => {
    sessionStorage.setItem("framelink:settings-draft:user-1", "{broken");

    expect(readSettingsDraft("user-1")).toBeNull();
  });

  it("clears the stored draft", () => {
    writeSettingsDraft("user-1", draft);

    clearSettingsDraft("user-1");

    expect(readSettingsDraft("user-1")).toBeNull();
  });
});
