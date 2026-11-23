"use client";

import { SettingsForm } from "@/app/dashboard/settings/SettingsForm";
import type { PayoutIdentity, PayoutProfile } from "@/app/dashboard/settings/payout-profile";
import { createClient } from "@/lib/supabase/client";

/** The shop payout form, saving to the referrer's own payout profile instead. */
export function AffiliatePayoutForm({ userId, initial }: {
  userId: string;
  initial: Pick<PayoutProfile, "payout_method" | "promptpay_id" | "bank_details"> & Partial<PayoutIdentity>;
}) {
  async function save(payload: PayoutProfile) {
    const { error } = await createClient().from("affiliate_payout_profiles")
      .upsert({ user_id: userId, ...payload, updated_at: new Date().toISOString() }, { onConflict: "user_id" }).select("user_id").single();
    if (error) throw error;
  }
  return <SettingsForm userId={userId} initial={{ id: userId, ...initial }} saveSettings={save} />;
}
