import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasAllowance,
  isUnlimited,
  limitReachedMessage,
  readAllowance,
  recordUsage,
  UNLIMITED_MICROS,
} from "@/lib/agent/usage";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));

beforeEach(() => rpc.mockReset());

describe("hasAllowance", () => {
  it("allows a seller who is under their ceiling", () => {
    expect(hasAllowance({ limitMicros: 300_000, usedMicros: 299_999, remainingMicros: 1 })).toBe(true);
  });

  it("stops a seller who has reached or passed it", () => {
    expect(hasAllowance({ limitMicros: 300_000, usedMicros: 300_000, remainingMicros: 0 })).toBe(false);
    expect(hasAllowance({ limitMicros: 300_000, usedMicros: 400_000, remainingMicros: 0 })).toBe(false);
  });

  it("always allows an unlimited seller and never a blocked one", () => {
    expect(hasAllowance({ limitMicros: UNLIMITED_MICROS, usedMicros: 9_000_000, remainingMicros: UNLIMITED_MICROS })).toBe(true);
    expect(hasAllowance({ limitMicros: 0, usedMicros: 0, remainingMicros: 0 })).toBe(false);
  });

  it("recognises the unlimited sentinel", () => {
    expect(isUnlimited(UNLIMITED_MICROS)).toBe(true);
    expect(isUnlimited(0)).toBe(false);
  });
});

describe("readAllowance", () => {
  it("reads the month's spend against the effective limit", async () => {
    rpc.mockResolvedValue({ data: [{ limit_micros: 300000, used_micros: 42000 }], error: null });
    await expect(readAllowance("user-1")).resolves.toEqual({
      limitMicros: 300_000,
      usedMicros: 42_000,
      remainingMicros: 258_000,
    });
    expect(rpc).toHaveBeenCalledWith("agent_usage_status", { p_user: "user-1" });
  });

  it("reports no remaining allowance once the limit is passed", async () => {
    rpc.mockResolvedValue({ data: [{ limit_micros: 100, used_micros: 500 }], error: null });
    await expect(readAllowance("user-1")).resolves.toMatchObject({ remainingMicros: 0 });
  });

  it("keeps the sentinel for an unlimited seller", async () => {
    rpc.mockResolvedValue({ data: [{ limit_micros: -1, used_micros: 500 }], error: null });
    await expect(readAllowance("user-1")).resolves.toMatchObject({
      limitMicros: UNLIMITED_MICROS,
      remainingMicros: UNLIMITED_MICROS,
    });
  });

  it("fails closed when the quota cannot be read", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(readAllowance("user-1")).rejects.toThrow("ตรวจสอบโควตา AI ไม่สำเร็จ");
  });
});

describe("recordUsage", () => {
  it("writes the token counts and returns the updated month total", async () => {
    rpc.mockResolvedValue({ data: 45_000, error: null });
    await expect(
      recordUsage({
        userId: "user-1",
        operation: "product-draft",
        model: "deepseek-flash",
        usage: { promptTokens: 97, cachedTokens: 32, completionTokens: 83 },
        costMicros: 129,
        limitMicros: 300_000,
      }),
    ).resolves.toEqual({ limitMicros: 300_000, usedMicros: 45_000, remainingMicros: 255_000 });
    expect(rpc).toHaveBeenCalledWith("agent_record_usage", {
      p_user: "user-1",
      p_operation: "product-draft",
      p_model: "deepseek-flash",
      p_prompt_tokens: 97,
      p_cached_tokens: 32,
      p_completion_tokens: 83,
      p_cost_micros: 129,
    });
  });

  it("raises when the spend cannot be recorded", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(
      recordUsage({
        userId: "user-1",
        operation: "product-draft",
        model: "deepseek-flash",
        usage: { promptTokens: 1, cachedTokens: 0, completionTokens: 1 },
        costMicros: 2,
        limitMicros: 0,
      }),
    ).rejects.toThrow("บันทึกการใช้งาน AI ไม่สำเร็จ");
  });
});

describe("limitReachedMessage", () => {
  it("explains a blocked account separately from an exhausted quota", () => {
    expect(limitReachedMessage({ limitMicros: 0, usedMicros: 0, remainingMicros: 0 })).toContain(
      "ถูกปิดการใช้งาน",
    );
    const exhausted = limitReachedMessage({
      limitMicros: 300_000,
      usedMicros: 310_000,
      remainingMicros: 0,
    });
    expect(exhausted).toContain("0.31 USD");
    expect(exhausted).toContain("0.30 USD");
    expect(exhausted).toContain("กรอกข้อมูลเองได้ตามปกติ");
  });
});
