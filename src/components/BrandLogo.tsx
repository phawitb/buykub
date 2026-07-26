export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label="FRAMELINK"
      className={`inline-flex font-bold tracking-tight ${className}`}
    >
      <span aria-hidden>FRAME</span>
      <span
        aria-hidden
        className="bg-gradient-to-r from-[#006CFC] via-[#475AFE] to-[#8938FB] bg-clip-text text-transparent"
      >
        LINK
      </span>
    </span>
  );
}
