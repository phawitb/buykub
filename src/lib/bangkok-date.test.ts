import { describe, expect, it } from "vitest";
import {
  bangkokDateKey,
  formatBangkokDateTime,
  recentBangkokDays,
} from "@/lib/bangkok-date";

describe("Bangkok calendar dates", () => {
  it("rolls over at midnight in Thailand instead of the server timezone", () => {
    const instant = new Date("2026-07-25T18:30:00.000Z");

    expect(bangkokDateKey(instant)).toBe("2026-07-26");
    expect(formatBangkokDateTime(instant)).toBe("26/7/2569 01:30:00");
    expect(recentBangkokDays(2, instant).map((day) => day.key)).toEqual([
      "2026-07-25",
      "2026-07-26",
    ]);
  });
});
