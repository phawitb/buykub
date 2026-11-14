import { BRAND_NAME } from "@/lib/brand";

/**
 * Solid two-tone wordmark. The previous gradient was dropped with the gradient
 * text ban: emphasis comes from colour and weight, not a fade.
 */
export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label={BRAND_NAME}
      className={`inline-flex font-semibold tracking-tight ${className}`}
    >
      <span aria-hidden>BUY</span>
      <span aria-hidden className="text-accent-text">
        KUB
      </span>
    </span>
  );
}
