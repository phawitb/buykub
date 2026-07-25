export function slugifyProductName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "product";
}

export function uniqueProductSlug(
  base: string,
  existingSlugs: readonly string[],
): string {
  const occupied = new Set(existingSlugs);
  if (!occupied.has(base)) return base;

  let suffix = 2;
  while (occupied.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
