"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function EmailLoginForm({
  next,
  sendMagicLink,
}: {
  next: string;
  sendMagicLink?: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const normalizedEmail = email.trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!validEmail || sending) return;
    setSending(true);
    setSentTo(null);
    setError(null);

    try {
      if (sendMagicLink) {
        await sendMagicLink(normalizedEmail);
      } else {
        const supabase = createClient();
        const { error: authError } = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (authError) throw authError;
      }
      setSentTo(normalizedEmail);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "ส่งลิงก์เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className="field-label">
        อีเมล
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="field-input mt-2"
        />
      </label>
      <button
        type="submit"
        disabled={!validEmail || sending}
        className="primary-button mt-4 w-full"
      >
        {sending ? "กำลังส่ง..." : "ส่งลิงก์เข้าสู่ระบบ"}
      </button>
      {sentTo && (
        <p
          role="status"
          className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-700"
        >
          ส่งลิงก์เข้าสู่ระบบไปที่ {sentTo} แล้ว กรุณาตรวจกล่องจดหมาย
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700"
        >
          {error}
        </p>
      )}
    </form>
  );
}
