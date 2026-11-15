import { describe, expect, it } from "vitest";
import {
  AGENT_MODELS,
  DEFAULT_AGENT_MODEL,
  formatUsd,
  isAgentModelId,
  isPeakPricing,
  modelRates,
  normalizeTokenUsage,
  usageCostMicros,
} from "@/lib/agent/pricing";

// 2026-11-18 is a Wednesday; 2026-11-21 a Saturday.
const peakWednesday = new Date("2026-11-18T02:30:00Z");
const offPeakWednesday = new Date("2026-11-18T05:30:00Z");
const saturday = new Date("2026-11-21T02:30:00Z");

describe("isPeakPricing", () => {
  it("treats both published weekday windows as peak", () => {
    expect(isPeakPricing(new Date("2026-11-18T01:00:00Z"))).toBe(true);
    expect(isPeakPricing(new Date("2026-11-18T03:59:00Z"))).toBe(true);
    expect(isPeakPricing(new Date("2026-11-18T06:00:00Z"))).toBe(true);
    expect(isPeakPricing(new Date("2026-11-18T09:59:00Z"))).toBe(true);
  });

  it("treats the gaps and the weekend as off-peak", () => {
    expect(isPeakPricing(new Date("2026-11-18T00:59:00Z"))).toBe(false);
    expect(isPeakPricing(offPeakWednesday)).toBe(false);
    expect(isPeakPricing(new Date("2026-11-18T10:00:00Z"))).toBe(false);
    expect(isPeakPricing(saturday)).toBe(false);
    expect(isPeakPricing(new Date("2026-11-22T02:30:00Z"))).toBe(false);
  });
});

describe("modelRates", () => {
  it("halves every rate outside the peak windows", () => {
    const peak = modelRates("deepseek-flash", peakWednesday);
    const offPeak = modelRates("deepseek-flash", offPeakWednesday);
    expect(peak).toEqual(AGENT_MODELS["deepseek-flash"].peak);
    expect(offPeak.cacheMissInput).toBeCloseTo(peak.cacheMissInput / 2, 10);
    expect(offPeak.output).toBeCloseTo(peak.output / 2, 10);
  });

  it("prices the default model below the pro model", () => {
    expect(DEFAULT_AGENT_MODEL).toBe("deepseek-flash");
    const flash = modelRates("deepseek-flash", peakWednesday);
    const pro = modelRates("deepseek-v4-pro", peakWednesday);
    expect(flash.cacheMissInput).toBeLessThan(pro.cacheMissInput);
    expect(flash.output).toBeLessThan(pro.output);
  });
});

describe("normalizeTokenUsage", () => {
  it("reads the DeepSeek usage block", () => {
    expect(
      normalizeTokenUsage({
        prompt_tokens: 97,
        completion_tokens: 83,
        prompt_cache_hit_tokens: 32,
        prompt_tokens_details: { cached_tokens: 0 },
      }),
    ).toEqual({ promptTokens: 97, cachedTokens: 32, completionTokens: 83 });
  });

  it("falls back to prompt_tokens_details when the flat field is absent", () => {
    expect(
      normalizeTokenUsage({ prompt_tokens: 40, prompt_tokens_details: { cached_tokens: 12 } })
        .cachedTokens,
    ).toBe(12);
  });

  it("never reports more cached tokens than prompt tokens", () => {
    expect(
      normalizeTokenUsage({ prompt_tokens: 10, prompt_cache_hit_tokens: 999 }).cachedTokens,
    ).toBe(10);
  });

  it("treats missing, negative and unparseable counts as zero", () => {
    expect(normalizeTokenUsage(null)).toEqual({
      promptTokens: 0,
      cachedTokens: 0,
      completionTokens: 0,
    });
    expect(
      normalizeTokenUsage({ prompt_tokens: -5, completion_tokens: "x" }),
    ).toEqual({ promptTokens: 0, cachedTokens: 0, completionTokens: 0 });
  });
});

describe("usageCostMicros", () => {
  it("prices cache misses and output at the published peak rate", () => {
    // 97 * 0.3 + 83 * 1.2 = 128.7 micro-USD, rounded up.
    expect(
      usageCostMicros(
        "deepseek-flash",
        { promptTokens: 97, cachedTokens: 0, completionTokens: 83 },
        peakWednesday,
      ),
    ).toBe(129);
  });

  it("charges cached input at the far cheaper cache-hit rate", () => {
    const cached = usageCostMicros(
      "deepseek-flash",
      { promptTokens: 1000, cachedTokens: 1000, completionTokens: 0 },
      peakWednesday,
    );
    const uncached = usageCostMicros(
      "deepseek-flash",
      { promptTokens: 1000, cachedTokens: 0, completionTokens: 0 },
      peakWednesday,
    );
    expect(cached).toBe(6);
    expect(uncached).toBe(300);
  });

  it("costs half as much off-peak", () => {
    const usage = { promptTokens: 1000, cachedTokens: 0, completionTokens: 1000 };
    expect(usageCostMicros("deepseek-flash", usage, offPeakWednesday)).toBe(
      usageCostMicros("deepseek-flash", usage, peakWednesday) / 2,
    );
  });

  it("never rounds a billed call down to free", () => {
    expect(
      usageCostMicros(
        "deepseek-flash",
        { promptTokens: 1, cachedTokens: 1, completionTokens: 0 },
        peakWednesday,
      ),
    ).toBe(1);
  });

  it("is zero only when nothing was used", () => {
    expect(
      usageCostMicros(
        "deepseek-flash",
        { promptTokens: 0, cachedTokens: 0, completionTokens: 0 },
        peakWednesday,
      ),
    ).toBe(0);
  });
});

describe("formatUsd", () => {
  it("keeps four decimals for the sub-cent amounts a single draft costs", () => {
    expect(formatUsd(0)).toBe("0.0000 USD");
    expect(formatUsd(3400)).toBe("0.0034 USD");
    expect(formatUsd(250_000)).toBe("0.25 USD");
    expect(formatUsd(12_500_000)).toBe("12.50 USD");
  });
});

describe("isAgentModelId", () => {
  it("accepts only the models the price table covers", () => {
    expect(isAgentModelId("deepseek-flash")).toBe(true);
    expect(isAgentModelId("deepseek-v4-pro")).toBe(true);
    expect(isAgentModelId("gpt-4")).toBe(false);
    expect(isAgentModelId(null)).toBe(false);
  });
});
