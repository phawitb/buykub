"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BRAND_NAME } from "@/lib/brand";
import { createClient } from "@/lib/supabase/client";

type Props = {
  connected: boolean;
  connectedEmail: string | null;
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
};

export function CalendarConnection({
  connected,
  connectedEmail,
  connect,
  disconnect,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function defaultConnect() {
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes:
          "openid email profile https://www.googleapis.com/auth/calendar.events",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
        redirectTo: `${window.location.origin}/auth/callback?calendar=1&next=${encodeURIComponent("/dashboard/settings")}`,
      },
    });
    if (oauthError) throw oauthError;
  }

  async function defaultDisconnect() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        google_provider_token: null,
        google_provider_refresh_token: null,
        google_calendar_connected_at: null,
      })
      .eq("id", user.id);
    if (updateError) throw updateError;
    router.refresh();
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(
        `เชื่อมต่อ Google Calendar ไม่สำเร็จ: ${
          actionError instanceof Error ? actionError.message : "กรุณาลองอีกครั้ง"
        }`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-b border-line pb-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Google Calendar</h2>
          <p className="mt-2 text-xs leading-6 text-muted">
            เชื่อมต่อเพื่อเพิ่มการจองลง Calendar และสร้าง Google Meet
            อัตโนมัติให้ทั้งคุณและลูกค้า
          </p>
          {connected && (
            <p className="mt-2 text-xs font-medium text-emerald-700">
              เชื่อมต่อแล้ว{connectedEmail ? ` · ${connectedEmail}` : ""}
            </p>
          )}
        </div>
        <span
          aria-hidden
          className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
            connected ? "bg-emerald-500" : "bg-line"
          }`}
        />
      </div>
      {!connected && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-950">
          <p className="font-semibold">ก่อนเชื่อมต่อ Google Calendar</p>
          <p className="mt-1">
            ตรวจสอบบัญชี Google และสิทธิ์ Calendar ที่ {BRAND_NAME} ขอเข้าถึง
            ก่อนยืนยันการเชื่อมต่อ
          </p>
        </div>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          run(connected ? (disconnect ?? defaultDisconnect) : (connect ?? defaultConnect))
        }
        className={connected ? "secondary-button mt-4" : "primary-button mt-4"}
      >
        {busy
          ? "กำลังเชื่อมต่อ..."
          : connected
            ? "ตัดการเชื่อมต่อ"
            : "เชื่อมต่อ Google Calendar"}
      </button>
      {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
    </section>
  );
}
