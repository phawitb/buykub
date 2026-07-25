import { describe, expect, it } from "vitest";
import {
  THAI_BANKS,
  filterThaiBanks,
  parseBankDetails,
  serializeBankDetails,
  validateBankAccount,
} from "./thai-banks";

describe("Thai bank payout model", () => {
  it("contains only the approved 16 Thai retail banks", () => {
    expect(THAI_BANKS).toHaveLength(16);
    expect(THAI_BANKS.map((bank) => bank.code)).toEqual(
      expect.arrayContaining(["scb", "bbl", "kbank", "ktb", "ttb", "gsb"]),
    );
    expect(THAI_BANKS.map((bank) => bank.code)).not.toEqual(
      expect.arrayContaining(["citi", "hsbc", "deutsche", "smbc", "icbc"]),
    );
  });

  it("serializes and parses structured bank details", () => {
    const value = {
      bankCode: "kbank",
      accountNumber: "1234567890",
      accountName: "สมชาย ใจดี",
      legacy: "",
    };

    expect(parseBankDetails(serializeBankDetails(value))).toEqual(value);
  });

  it("preserves legacy plain-text bank details", () => {
    expect(parseBankDetails("ธนาคารเดิม · 1234 · สมชาย")).toEqual({
      bankCode: "",
      accountNumber: "",
      accountName: "",
      legacy: "ธนาคารเดิม · 1234 · สมชาย",
    });
  });

  it("searches Thai names, English names, and short codes", () => {
    expect(filterThaiBanks("กสิกร").map((bank) => bank.code)).toEqual(["kbank"]);
    expect(filterThaiBanks("Siam").map((bank) => bank.code)).toEqual(["scb"]);
    expect(filterThaiBanks("ttb").map((bank) => bank.code)).toEqual(["ttb"]);
  });

  it("requires bank, a 6–16 digit account number, and account name", () => {
    expect(
      validateBankAccount({
        bankCode: "",
        accountNumber: "123",
        accountName: "",
        legacy: "",
      }),
    ).toEqual({
      bankCode: "กรุณาเลือกธนาคาร",
      accountNumber: "กรอกเลขบัญชี 6–16 หลัก",
      accountName: "กรุณากรอกชื่อบัญชี",
    });
  });
});
