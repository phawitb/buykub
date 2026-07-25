export type SettingsDraft = {
  slug: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  accentColor: string;
  payoutMethod: "promptpay" | "bank";
  promptpayId: string;
  bankDetails: string;
};

function storageKey(userId: string) {
  return `framelink:settings-draft:${userId}`;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isSettingsDraft(value: unknown): value is SettingsDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.slug === "string" &&
    typeof draft.name === "string" &&
    typeof draft.bio === "string" &&
    isNullableString(draft.avatarUrl) &&
    isNullableString(draft.coverUrl) &&
    typeof draft.accentColor === "string" &&
    (draft.payoutMethod === "promptpay" || draft.payoutMethod === "bank") &&
    typeof draft.promptpayId === "string" &&
    typeof draft.bankDetails === "string"
  );
}

export function readSettingsDraft(userId: string): SettingsDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(storageKey(userId));
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return isSettingsDraft(parsed) ? parsed : null;
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
