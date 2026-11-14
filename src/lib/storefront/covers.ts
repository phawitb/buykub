import credits from "../../../public/images/shop-covers/credits.json";

export const DEFAULT_COVERS = credits.map(({ id, path, smallPath, author, source }) => ({ id, path, smallPath, author, source }));

/** A stable pseudo-random assignment avoids changing the cover on reload/hydration. */
export function getDefaultCover(seed: string) {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619);
  return DEFAULT_COVERS[(hash >>> 0) % DEFAULT_COVERS.length];
}

export function getShopCover(shop: { slug: string; cover_url: string | null }) {
  return shop.cover_url || getDefaultCover(shop.slug).path;
}
