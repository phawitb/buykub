import { parseBankDetails } from "./thai-banks";

export type SettingsDraft = {
  slug: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  accentColor: string;
  payoutMethod: "promptpay" | "bank";
  promptpayId: string;
  bankCode: string;
  bankAccountNumber: string;
  bankAccountName: string;
  bankLegacy: string;
};

function storageKey(userId: string) {
  return `framelink:settings-draft:${userId}`;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function normalizeSettingsDraft(value: unknown): SettingsDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Record<string, unknown>;
  const baseValid =
    typeof draft.slug === "string" &&
    typeof draft.name === "string" &&
    typeof draft.bio === "string" &&
    isNullableString(draft.avatarUrl) &&
    isNullableString(draft.coverUrl) &&
    typeof draft.accentColor === "string" &&
    (draft.payoutMethod === "promptpay" || draft.payoutMethod === "bank") &&
    typeof draft.promptpayId === "string";
  if (!baseValid) return null;

  let bankFields;
  if (
    typeof draft.bankCode === "string" &&
    typeof draft.bankAccountNumber === "string" &&
    typeof draft.bankAccountName === "string" &&
    typeof draft.bankLegacy === "string"
  ) {
    bankFields = {
      bankCode: draft.bankCode,
      bankAccountNumber: draft.bankAccountNumber,
      bankAccountName: draft.bankAccountName,
      bankLegacy: draft.bankLegacy,
    };
  } else if (typeof draft.bankDetails === "string") {
    const legacyDraft = parseBankDetails(draft.bankDetails);
    bankFields = {
      bankCode: legacyDraft.bankCode,
      bankAccountNumber: legacyDraft.accountNumber,
      bankAccountName: legacyDraft.accountName,
      bankLegacy: legacyDraft.legacy,
    };
  } else {
    return null;
  }

  return {
    slug: draft.slug as string,
    name: draft.name as string,
    bio: draft.bio as string,
    avatarUrl: draft.avatarUrl as string | null,
    coverUrl: draft.coverUrl as string | null,
    accentColor: draft.accentColor as string,
    payoutMethod: draft.payoutMethod as "promptpay" | "bank",
    promptpayId: draft.promptpayId as string,
    ...bankFields,
  };
}

export function readSettingsDraft(userId: string): SettingsDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(storageKey(userId));
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return normalizeSettingsDraft(parsed);
  } catch {
    return null;
  }
}

export function writeSettingsDraft(userId: string, draft: SettingsDraft) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(userId), JSON.stringify(draft));
  } catch {
    // Settings remains usable when storage is unavailable or full.
  }
}

export function clearSettingsDraft(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey(userId));
  } catch {
    // Settings remains usable when storage is unavailable.
  }
}
