import { describe, expect, it } from "vitest";
import {
  AgentAdminInputError,
  MAX_AGENT_LIMIT_MICROS,
  parseAgentAdminAction,
} from "@/lib/agent/admin";
import {
  limitLabel,
  microsToUsdInput,
  operationLabel,
  usdInputToMicros,
} from "@/app/dashboard/admin/AgentPanel";

const userId = "4f1a2b3c-1111-4222-8333-444455556666";

describe("parseAgentAdminAction", () => {
  it("accepts a per-seller limit in micro-USD", () => {
    expect(parseAgentAdminAction("agent-limit", { userId, limitMicros: 500_000 })).toEqual({
      action: "agent-limit",
      userId,
      limitMicros: 500_000,
    });
  });

  it("accepts the unlimited sentinel and a blocking zero", () => {
    expect(parseAgentAdminAction("agent-limit", { userId, limitMicros: -1 })).toMatchObject({
      limitMicros: -1,
    });
    expect(parseAgentAdminAction("agent-limit", { userId, limitMicros: 0 })).toMatchObject({
      limitMicros: 0,
    });
  });

  it("treats null as clearing the override", () => {
    expect(parseAgentAdminAction("agent-limit", { userId, limitMicros: null })).toMatchObject({
      limitMicros: null,
    });
  });

  it("rejects a limit below the unlimited sentinel or above the cap", () => {
    expect(() => parseAgentAdminAction("agent-limit", { userId, limitMicros: -2 })).toThrow(
      AgentAdminInputError,
    );
    expect(() =>
      parseAgentAdminAction("agent-limit", { userId, limitMicros: MAX_AGENT_LIMIT_MICROS + 1 }),
    ).toThrow(AgentAdminInputError);
  });

  it("rejects a limit that is not a number", () => {
    expect(() => parseAgentAdminAction("agent-limit", { userId, limitMicros: "มาก" })).toThrow(
      "กรุณากรอกโควตาเป็นตัวเลข",
    );
  });

  it("rejects anything that is not a UUID in the user field", () => {
    expect(() => parseAgentAdminAction("agent-limit", { userId: "all", limitMicros: 1 })).toThrow(
      "Invalid record ID",
    );
    expect(() => parseAgentAdminAction("agent-limit", { limitMicros: 1 })).toThrow(
      "Invalid record ID",
    );
  });

  it("does not allow the platform default to be unlimited", () => {
    expect(parseAgentAdminAction("agent-default-limit", { limitMicros: 0 })).toEqual({
      action: "agent-default-limit",
      limitMicros: 0,
    });
    expect(() => parseAgentAdminAction("agent-default-limit", { limitMicros: -1 })).toThrow(
      "โควตาอยู่นอกช่วงที่รองรับ",
    );
  });

  it("rejects an unknown action or a non-object body", () => {
    expect(() => parseAgentAdminAction("agent-nope", {})).toThrow("Unknown admin action");
    expect(() => parseAgentAdminAction("agent-limit", null)).toThrow("Invalid request");
    expect(() => parseAgentAdminAction("agent-limit", [])).toThrow("Invalid request");
  });

  it("reports input problems as 400, not a server failure", () => {
    expect(new AgentAdminInputError("x").status).toBe(400);
  });
});

describe("limit display helpers", () => {
  it("labels each kind of ceiling", () => {
    expect(limitLabel(-1)).toBe("ไม่จำกัด");
    expect(limitLabel(0)).toBe("ปิดใช้งาน");
    expect(limitLabel(300_000)).toBe("0.30 USD / เดือน");
  });

  it("round-trips a USD input through micro-USD", () => {
    expect(usdInputToMicros("0.30")).toBe(300_000);
    expect(microsToUsdInput(300_000)).toBe("0.3");
    expect(usdInputToMicros(microsToUsdInput(1_250_000))).toBe(1_250_000);
  });

  it("refuses a USD input that is negative, huge or not a number", () => {
    expect(usdInputToMicros("-1")).toBeNull();
    expect(usdInputToMicros("5000")).toBeNull();
    expect(usdInputToMicros("")).toBeNull();
    expect(usdInputToMicros("abc")).toBeNull();
  });
});

describe("operationLabel", () => {
  it("separates the two draft paths in plain words", () => {
    // Both run on the same model, so the admin page has nothing else to go on.
    expect(operationLabel("product-draft")).toBe("ร่างสินค้าจากข้อความใน PDF");
    expect(operationLabel("product-draft-ocr")).toBe("ร่างสินค้าจาก PDF สแกน (OCR)");
  });

  it("shows an unknown operation rather than hiding the spend", () => {
    expect(operationLabel("something-new")).toBe("something-new");
  });
});
