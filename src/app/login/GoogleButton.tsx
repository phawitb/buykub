"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GoogleButton({ next }: { next: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef(0);

  useEffect(() => {
    if (!loading) return;
    const timeout = window.setTimeout(() => {
      attempt.current += 1;
      setLoading(false);
      setError("เชื่อมต่อ Google ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง");
    }, 15000);
    return () => window.clearTimeout(timeout);
  }, [loading]);

  async function signInWithGoogle() {
    if (loading) return;
    const currentAttempt = ++attempt.current;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (authError) throw authError;
    } catch {
      if (currentAttempt !== attempt.current) return;
      setError("เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองอีกครั้ง");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-full border border-line bg-paper px-6 py-3.5 text-sm font-medium text-ink transition hover:bg-paper-dim disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
          />
          <path
            fill="currentColor"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.85.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z"
          />
          <path
            fill="currentColor"
            d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z"
          />
          <path
            fill="currentColor"
            d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
          />
        </svg>
        {loading ? "กำลังเชื่อมต่อ..." : "เข้าสู่ระบบด้วย Google"}
      </button>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}
