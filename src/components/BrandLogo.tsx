import { BRAND_NAME } from "@/lib/brand";

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label={BRAND_NAME}
      className={`inline-flex font-bold tracking-tight ${className}`}
    >
      <span aria-hidden>BUY</span>
      <span
        aria-hidden
        className="bg-gradient-to-r from-[#2563EB] to-[#7C3AED] bg-clip-text text-transparent"
      >
        KUB
      </span>
    </span>
  );
}
