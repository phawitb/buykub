export type ThaiBank = {
  code: string;
  nameTh: string;
  nameEn: string;
  shortName: string;
  logo: string;
  popular?: boolean;
};

export type BankDetails = {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  legacy: string;
};

export type BankAccountErrors = Partial<
  Record<"bankCode" | "accountNumber" | "accountName", string>
>;

export const THAI_BANKS: ThaiBank[] = [
  { code: "scb", nameTh: "ธนาคารไทยพาณิชย์", nameEn: "Siam Commercial Bank", shortName: "SCB", logo: "/banks/scb.png", popular: true },
  { code: "bbl", nameTh: "ธนาคารกรุงเทพ", nameEn: "Bangkok Bank", shortName: "BBL", logo: "/banks/bbl.png", popular: true },
  { code: "kbank", nameTh: "ธนาคารกสิกรไทย", nameEn: "Kasikornbank", shortName: "KBank", logo: "/banks/kbank.png", popular: true },
  { code: "ktb", nameTh: "ธนาคารกรุงไทย", nameEn: "Krungthai Bank", shortName: "KTB", logo: "/banks/ktb.png", popular: true },
  { code: "ttb", nameTh: "ธนาคารทหารไทยธนชาต", nameEn: "TMBThanachart Bank", shortName: "ttb", logo: "/banks/ttb.png", popular: true },
  { code: "bay", nameTh: "ธนาคารกรุงศรีอยุธยา", nameEn: "Bank of Ayudhya", shortName: "Krungsri", logo: "/banks/bay.png", popular: true },
  { code: "cimbt", nameTh: "ธนาคารซีไอเอ็มบี ไทย", nameEn: "CIMB Thai", shortName: "CIMB", logo: "/banks/cimbt.png" },
  { code: "lhb", nameTh: "ธนาคารแลนด์ แอนด์ เฮ้าส์", nameEn: "Land and Houses Bank", shortName: "LH Bank", logo: "/banks/lhb.png" },
  { code: "uob", nameTh: "ธนาคารยูโอบี", nameEn: "UOB Thailand", shortName: "UOB", logo: "/banks/uob.png" },
  { code: "kkp", nameTh: "ธนาคารเกียรตินาคินภัทร", nameEn: "Kiatnakin Phatra Bank", shortName: "KKP", logo: "/banks/kkp.png" },
  { code: "tisco", nameTh: "ธนาคารทิสโก้", nameEn: "TISCO Bank", shortName: "TISCO", logo: "/banks/tisco.png" },
  { code: "tcrb", nameTh: "ธนาคารไทยเครดิต", nameEn: "Thai Credit Bank", shortName: "Thai Credit", logo: "/banks/tcrb.png" },
  { code: "gsb", nameTh: "ธนาคารออมสิน", nameEn: "Government Savings Bank", shortName: "GSB", logo: "/banks/gsb.png" },
  { code: "baac", nameTh: "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร", nameEn: "Bank for Agriculture and Agricultural Cooperatives", shortName: "ธ.ก.ส.", logo: "/banks/baac.png" },
  { code: "ghb", nameTh: "ธนาคารอาคารสงเคราะห์", nameEn: "Government Housing Bank", shortName: "ธอส.", logo: "/banks/ghb.png" },
  { code: "ibank", nameTh: "ธนาคารอิสลามแห่งประเทศไทย", nameEn: "Islamic Bank of Thailand", shortName: "iBank", logo: "/banks/ibank.png" },
];

export function getThaiBank(code: string) {
  return THAI_BANKS.find((bank) => bank.code === code) ?? null;
}

export function filterThaiBanks(query: string) {
  const normalized = query.trim().toLocaleLowerCase("th-TH");
  if (!normalized) return THAI_BANKS;
  return THAI_BANKS.filter((bank) =>
    [bank.nameTh, bank.nameEn, bank.shortName, bank.code].some((value) =>
      value.toLocaleLowerCase("th-TH").includes(normalized),
    ),
  );
}

export function parseBankDetails(value: string | null | undefined): BankDetails {
  const empty: BankDetails = {
    bankCode: "",
    accountNumber: "",
    accountName: "",
    legacy: "",
  };
  if (!value) return empty;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (
      parsed.version === 1 &&
      typeof parsed.bankCode === "string" &&
      typeof parsed.accountNumber === "string" &&
      typeof parsed.accountName === "string"
    ) {
      return {
        bankCode: parsed.bankCode,
        accountNumber: parsed.accountNumber,
        accountName: parsed.accountName,
        legacy: "",
      };
    }
  } catch {
    // Plain text is a legacy value.
  }
  return { ...empty, legacy: value };
}

export function serializeBankDetails(value: BankDetails) {
  return JSON.stringify({
    version: 1,
    bankCode: value.bankCode,
    accountNumber: value.accountNumber.replace(/\D/g, ""),
    accountName: value.accountName.trim(),
  });
}

export function validateBankAccount(value: BankDetails): BankAccountErrors {
  const errors: BankAccountErrors = {};
  if (!getThaiBank(value.bankCode)) errors.bankCode = "กรุณาเลือกธนาคาร";
  if (!/^\d{6,16}$/.test(value.accountNumber.replace(/\D/g, ""))) {
    errors.accountNumber = "กรอกเลขบัญชี 6–16 หลัก";
  }
  if (!value.accountName.trim()) errors.accountName = "กรุณากรอกชื่อบัญชี";
  return errors;
}
