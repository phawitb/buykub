export type PayoutIdentity = {
  full_name_th: string;
  contact_phone: string;
  national_id: string;
  address_line: string;
  subdistrict: string;
  district: string;
  province: string;
  postal_code: string;
};

export type PayoutProfile = PayoutIdentity & {
  payout_method: "promptpay" | "bank";
  promptpay_id: string | null;
  bank_details: string | null;
};

export type PayoutIdentityErrors = Partial<Record<keyof PayoutIdentity, string>>;

export const emptyPayoutIdentity: PayoutIdentity = {
  full_name_th: "", contact_phone: "", national_id: "", address_line: "",
  subdistrict: "", district: "", province: "", postal_code: "",
};

export function normalizePayoutName(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ");
}

export function isThaiNationalId(value: string): boolean {
  if (!/^[1-8][0-9]{12}$/.test(value)) return false;
  const sum = [...value.slice(0, 12)].reduce((total, digit, index) => total + Number(digit) * (13 - index), 0);
  return (11 - sum % 11) % 10 === Number(value[12]);
}

export function validatePayoutIdentity(value: PayoutIdentity): PayoutIdentityErrors {
  const errors: PayoutIdentityErrors = {};
  // Thai letters/combining marks only; at least given name and surname.
  const parts = value.full_name_th.trim().split(/ +/);
  if (value.full_name_th.length > 200 || parts.length < 2 || parts.some((part) => !/^[ก-ฮะ-ฺเ-ๅ็-๎]+$/.test(part) || !/[ก-ฮ]/.test(part))) {
    errors.full_name_th = "กรอกชื่อและนามสกุลภาษาไทยเท่านั้น โดยเว้นวรรคระหว่างชื่อและนามสกุล";
  }
  if (!/^0[0-9]{9}$/.test(value.contact_phone)) errors.contact_phone = "กรอกเบอร์โทรติดต่อ 10 หลัก เริ่มต้นด้วย 0";
  if (!isThaiNationalId(value.national_id)) errors.national_id = "กรอกเลขบัตรประชาชน 13 หลักที่ถูกต้อง";
  for (const field of ["address_line", "subdistrict", "district", "province"] as const) {
    if (!value[field].trim() || value[field].length > (field === "address_line" ? 500 : 100)) errors[field] = "กรุณากรอกข้อมูลที่อยู่ให้ครบถ้วนและไม่เกินความยาวที่กำหนด";
  }
  if (!/^[0-9]{5}$/.test(value.postal_code)) errors.postal_code = "กรอกรหัสไปรษณีย์ 5 หลัก";
  return errors;
}
