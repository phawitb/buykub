import { describe, expect, it } from "vitest";
import { isThaiNationalId, validatePayoutIdentity } from "../payout-profile";

export const validIdentity = {
  full_name_th: "สมชาย ใจดี", contact_phone: "0812345678", national_id: "1101700207030",
  address_line: "12/3 หมู่ 4 ซอยสุขใจ ถนนสุขใจ", subdistrict: "คลองตัน", district: "คลองเตย",
  province: "กรุงเทพมหานคร", postal_code: "10110",
};

describe("private payout identity validation", () => {
  it("accepts complete Thai identity and registered address", () => {
    expect(isThaiNationalId(validIdentity.national_id)).toBe(true);
    expect(validatePayoutIdentity(validIdentity)).toEqual({});
  });
  it.each(["John ใจดี", "สมชาย", "สมชาย ใจดี๑", "สมชาย ใจดี!", "สมชาย ใจๆ", "สมชาย ใจฯ", "   ", "่่ ่่"])("rejects invalid Thai full name %s", (full_name_th) => {
    expect(validatePayoutIdentity({ ...validIdentity, full_name_th })).toHaveProperty("full_name_th");
  });
  it.each(["1234567890123", "0000000000000", "1101700207031", "110170020703", "110170020703ก"])("rejects malformed/checksum-invalid ID %s", (national_id) => {
    expect(validatePayoutIdentity({ ...validIdentity, national_id })).toHaveProperty("national_id");
  });
  it.each(["contact_phone", "address_line", "subdistrict", "district", "province", "postal_code"] as const)("requires %s", (field) => {
    expect(validatePayoutIdentity({ ...validIdentity, [field]: "  " })).toHaveProperty(field);
  });
  it("requires exact digit-only telephone and postal lengths", () => {
    expect(validatePayoutIdentity({ ...validIdentity, contact_phone: "081-2345678", postal_code: "๑๐๑๑๐" })).toMatchObject({ contact_phone: expect.any(String), postal_code: expect.any(String) });
  });
});
