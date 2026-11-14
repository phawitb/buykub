"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BankAccountFields } from "./BankAccountFields";
import { parseBankDetails, serializeBankDetails, validateBankAccount, type BankAccountErrors, type BankDetails } from "./thai-banks";

import { emptyPayoutIdentity, normalizePayoutName, validatePayoutIdentity, type PayoutIdentity, type PayoutIdentityErrors, type PayoutProfile } from "./payout-profile";
import { WalletIcon } from "@/components/icons";

export function SettingsForm({ initial, userId, saveSettings }: {
  initial: Pick<PayoutProfile, "payout_method" | "promptpay_id" | "bank_details"> & Partial<PayoutIdentity> & { id: string };
  userId: string;
  saveSettings?: (payload: PayoutProfile) => Promise<void>;
}) {
  const router = useRouter();
  const [payoutMethod, setPayoutMethod] = useState(initial.payout_method);
  const [promptpayId, setPromptpayId] = useState(initial.promptpay_id ?? "");
  const [bankAccount, setBankAccount] = useState<BankDetails>(() => parseBankDetails(initial.bank_details));
  const [bankErrors, setBankErrors] = useState<BankAccountErrors>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [identity, setIdentity] = useState<PayoutIdentity>(() => Object.fromEntries(
    Object.keys(emptyPayoutIdentity).map((key) => [key, initial[key as keyof PayoutIdentity] ?? ""]),
  ) as PayoutIdentity);
  const [identityErrors, setIdentityErrors] = useState<PayoutIdentityErrors>({});
  const [showNationalId, setShowNationalId] = useState(false);

  useEffect(() => {
    // Remove old sensitive drafts, including drafts for previously signed-in users.
    for (const storageName of ["sessionStorage", "localStorage"] as const) {
      try {
        const storage = window[storageName];
        for (let index = storage.length - 1; index >= 0; index--) {
          const key = storage.key(index);
          if (key?.startsWith("buykub:payout-draft:") || key?.startsWith("framelink:settings-draft:")) storage.removeItem(key);
        }
      } catch { /* The form remains usable when browser storage is disabled. */ }
    }
  }, [userId, initial.id]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null); setSaved(false);
    const normalizedPromptPay = promptpayId.replace(/\D/g, "");
    if (payoutMethod === "promptpay" && !/^(?:\d{10}|\d{13})$/.test(normalizedPromptPay)) {
      setError("กรอกเบอร์โทร 10 หลัก หรือเลขบัตรประชาชน 13 หลัก"); return;
    }
    if (payoutMethod === "bank") {
      const errors = validateBankAccount(bankAccount);
      setBankErrors(errors);
      if (Object.keys(errors).length) return;
    } else setBankErrors({});
    const normalizedIdentity = Object.fromEntries(Object.entries(identity).map(([key, value]) => [key, value.trim()])) as PayoutIdentity;
    normalizedIdentity.full_name_th = normalizePayoutName(normalizedIdentity.full_name_th);
    const nextIdentityErrors = validatePayoutIdentity(normalizedIdentity);
    setIdentityErrors(nextIdentityErrors);
    if (Object.keys(nextIdentityErrors).length) return;
    const normalizedAccountName = normalizePayoutName(bankAccount.accountName);
    if (payoutMethod === "bank" && normalizedAccountName !== normalizedIdentity.full_name_th) {
      setBankErrors({ accountName: "ชื่อบัญชีต้องเป็นชื่อเดียวกับข้อมูลที่ให้ไว้ข้างต้นเท่านั้น" });
      return;
    }
    const payload: PayoutProfile = {
      ...normalizedIdentity,
      payout_method: payoutMethod,
      promptpay_id: payoutMethod === "promptpay" ? normalizedPromptPay : null,
      bank_details: payoutMethod === "bank" ? serializeBankDetails({ ...bankAccount, accountName: normalizedAccountName }) : null,
    };
    setSaving(true);
    try {
      if (saveSettings) await saveSettings(payload);
      else {
        const { error: dbError } = await createClient().from("seller_payout_profiles")
          .upsert({ shop_id: initial.id, ...payload }, { onConflict: "shop_id" }).select("shop_id").single();
        if (dbError) throw dbError;
      }
      setPromptpayId(normalizedPromptPay);
      setShowNationalId(false);
      setSaved(true);
      router.refresh();
    } catch {
      // Database errors can include the rejected row and sensitive identity data.
      setError("บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลและลองอีกครั้ง");
    } finally { setSaving(false); }
  }

  return <form noValidate autoComplete="off" onSubmit={handleSubmit} className="space-y-8">
      <section className="border-b border-line pb-8">
        <h2 className="text-sm font-semibold text-ink">ข้อมูลรับเงิน</h2>

        <p className="mt-2 text-sm text-muted">กรอกข้อมูลผู้รับเงินให้ครบทุกช่อง เพื่อใช้ระบุผู้รับเงิน ติดต่อ และดำเนินการจ่ายรายได้ ข้อมูลนี้ไม่แสดงในหน้าร้านสาธารณะ</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {([
            ["full_name_th", "ชื่อ–นามสกุล (ภาษาไทยเท่านั้น)", 200],
            ["contact_phone", "เบอร์โทรติดต่อ", 10],
            ["national_id", "เลขบัตรประชาชน 13 หลัก", 13],
            ["address_line", "ที่อยู่ตามบัตรประชาชน (บ้านเลขที่ หมู่ ซอย ถนน)", 500],
            ["subdistrict", "ตำบล / แขวง", 100],
            ["district", "อำเภอ / เขต", 100],
            ["province", "จังหวัด", 100],
            ["postal_code", "รหัสไปรษณีย์", 5],
          ] as const).map(([field, label, maxLength]) => <div key={field} className={field === "address_line" ? "sm:col-span-2" : ""}>
            <label htmlFor={`payout-${field}`} className="mb-1.5 block text-xs font-medium text-ink-soft">{label} <span aria-hidden="true">*</span></label>
            <div className="flex gap-2">
              <input id={`payout-${field}`} required maxLength={maxLength}
                type={field === "national_id" && !showNationalId ? "password" : field === "contact_phone" ? "tel" : "text"}
                inputMode={["national_id", "contact_phone", "postal_code"].includes(field) ? "numeric" : "text"}
                autoComplete="off" value={identity[field]}
                aria-invalid={!!identityErrors[field]} aria-describedby={identityErrors[field] ? `error-${field}` : undefined}
                onChange={(event) => setIdentity({ ...identity, [field]: event.target.value })}
                className="min-w-0 w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink" />
              {field === "national_id" && <button type="button" aria-label={showNationalId ? "ซ่อนเลขบัตรประชาชน" : "แสดงเลขบัตรประชาชน"} aria-pressed={showNationalId} onClick={() => setShowNationalId(!showNationalId)} className="shrink-0 text-xs text-muted">{showNationalId ? "ซ่อน" : "แสดง"}</button>}
            </div>
            {identityErrors[field] && <p id={`error-${field}`} role="alert" className="mt-1 text-xs text-red-600">{identityErrors[field]}</p>}
          </div>)}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
              payoutMethod === "promptpay"
                ? "border-accent bg-accent-soft"
                : "border-line bg-paper hover:border-ink"
            }`}
          >
            <input
              type="radio"
              name="payout-method"
              aria-label="PromptPay เบอร์/บัตรประชาชน"
              checked={payoutMethod === "promptpay"}
              onChange={() => setPayoutMethod("promptpay")}
              className="sr-only"
            />
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-sm font-bold text-accent"
            >
              ฿
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">
                PromptPay
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                เบอร์/บัตรประชาชน
              </span>
            </span>
          </label>
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
              payoutMethod === "bank"
                ? "border-accent bg-accent-soft"
                : "border-line bg-paper hover:border-ink"
            }`}
          >
            <input
              type="radio"
              name="payout-method"
              aria-label="โอนเข้าบัญชีธนาคาร ทุกธนาคารไทย"
              checked={payoutMethod === "bank"}
              onChange={() => setPayoutMethod("bank")}
              className="sr-only"
            />
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-sm text-accent"
            >
              <WalletIcon className="size-4.5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">
                โอนเข้าบัญชีธนาคาร
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                ทุกธนาคารไทย
              </span>
            </span>
          </label>
        </div>

        <div className="mt-4">
          {payoutMethod === "promptpay" ? (
            <div>
              <label htmlFor="promptpay-id" className="mb-1.5 block text-xs font-medium text-ink-soft">
                เลข PromptPay (เบอร์โทร/บัตรประชาชน)
              </label>
              <input
                id="promptpay-id"
                value={promptpayId}
                onChange={(e) =>
                  setPromptpayId(e.target.value.replace(/\D/g, "").slice(0, 13))
                }
                inputMode="numeric"
                placeholder="เบอร์โทร 10 หลัก หรือเลขบัตร 13 หลัก"
                className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
              />
            </div>
          ) : (
            <BankAccountFields
              value={bankAccount}
              onChange={(nextValue) => {
                setBankAccount(nextValue);
                if (Object.keys(bankErrors).length > 0) {
                  setBankErrors(validateBankAccount(nextValue));
                }
              }}
              errors={bankErrors}
            />
          )}
        </div>

        <p className="mt-4 text-xs text-muted">
          ชื่อบัญชีต้องเป็นชื่อเดียวกับข้อมูลที่ให้ไว้ข้างต้นเท่านั้น
        </p>
      </section>

    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    <div className="flex items-center gap-3">
      <button type="submit" disabled={saving} className="primary-button disabled:opacity-60">{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
      {saved && <span role="status" className="text-sm text-emerald-700">บันทึกสำเร็จ</span>}
    </div>
  </form>;
}
