export const BRAND_NAME = "BUYKUB";
export const BRAND_DOMAIN = "buykub.com";
export const BRAND_ORIGIN = `https://${BRAND_DOMAIN}`;
export const SUPPORT_EMAIL = "support@buykub.com";
export const ORDER_EMAIL = "orders@notify.buykub.com";

function pathSegment(value: string) {
  return encodeURIComponent(value.replace(/^\/+|\/+$/g, ""));
}

export function shopUrl(slug: string) {
  return `${BRAND_ORIGIN}/${pathSegment(slug)}`;
}

export function productUrl(shopSlug: string, productSlug: string) {
  return `${shopUrl(shopSlug)}/${pathSegment(productSlug)}`;
}
