export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label="FRAMELINK"
      className={`inline-flex font-bold tracking-tight ${className}`}
    >
      <span aria-hidden>FRAME</span>
      <span
        aria-hidden
        className="bg-gradient-to-r from-[#2563EB] to-[#4F46E5] bg-clip-text text-transparent"
      >
        LINK
      </span>
    </span>
  );
}
