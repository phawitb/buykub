export function formatTHB(cents: number): string {
  const baht = cents / 100;
  return `฿${baht.toLocaleString("th-TH", {
    minimumFractionDigits: Number.isInteger(baht) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function discountPercent(
  priceCents: number,
  comparePriceCents: number | null,
): number | null {
  if (!comparePriceCents || comparePriceCents <= priceCents) return null;
  return Math.round((1 - priceCents / comparePriceCents) * 100);
}
