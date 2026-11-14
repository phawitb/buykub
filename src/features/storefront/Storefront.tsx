import Link from "next/link";
import { BRAND_DOMAIN, shopUrl } from "@/lib/brand";
import { DEFAULT_COVERS, getShopCover } from "@/lib/storefront/covers";
import type { ReactNode } from "react";

export type ShopAppearance = {
  slug: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  accent_color: string;
};

// Shared by the public shop and the owner's workspace; analytics stays on the public route.
export function Storefront({ shop, publicSlug = shop.slug, headerActions, avatarActions, nameContent, bioContent, coverActions, productActions, productCount, children, titleAs: Title = "h1" }: {
  shop: ShopAppearance;
  publicSlug?: string | null;
  titleAs?: "h1" | "h2";
  headerActions?: ReactNode;
  avatarActions?: ReactNode;
  nameContent?: ReactNode;
  bioContent?: ReactNode;
  coverActions?: ReactNode;
  productActions?: ReactNode;
  productCount: number;
  children: ReactNode;
}) {
  const coverUrl = getShopCover(shop);
  const defaultCover = DEFAULT_COVERS.find((cover) => cover.path === coverUrl);
  return (
    <div className="w-full overflow-hidden bg-paper">
      <div className="relative h-44 w-full bg-paper-dim sm:h-56 lg:h-72" style={{ backgroundColor: shop.cover_url ? undefined : shop.accent_color || "var(--color-paper-dim)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverUrl} alt={`${shop.name} cover`} width={1600} height={500}
          srcSet={defaultCover ? `${defaultCover.smallPath} 800w, ${defaultCover.path} 1600w` : undefined}
          sizes={defaultCover ? "100vw" : undefined}
          className="h-full w-full object-cover" fetchPriority="high" />
        {coverActions && <div className="absolute inset-0">{coverActions}</div>}
      </div>
      <div className="px-5 pb-14 sm:px-8 lg:px-12">
        <div className="relative -mt-10 flex h-20 items-end justify-between gap-3">
          <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full ring-4 ring-paper bg-ink text-2xl font-bold text-paper">
            {shop.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.avatar_url} alt={shop.name} className="h-full w-full object-cover" />
            ) : shop.name.slice(0, 1).toUpperCase() || "◇"}
            {avatarActions}
          </div>
          {headerActions && <div className="mb-[-8px]">{headerActions}</div>}
        </div>
        <Title className="mt-4 text-2xl font-bold sm:text-3xl text-ink">{nameContent ?? (shop.name || "ร้านของคุณ")}</Title>
        {publicSlug && <a href={shopUrl(publicSlug)} className="mt-1 inline-block max-w-full break-all text-xs text-muted underline decoration-line underline-offset-4 transition hover:text-ink">{BRAND_DOMAIN}/{publicSlug}</a>}
        {(bioContent || shop.bio) && <div className="mt-1.5 max-w-lg whitespace-pre-line text-sm leading-6 text-muted">{bioContent ?? <p>{shop.bio}</p>}</div>}
        <section className="mt-8 border-t border-line pt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-semibold tracking-[0.2em] text-muted">สินค้าดิจิทัล</h2>
            {productActions ?? <span className="text-xs tabular-nums text-muted">{String(productCount).padStart(2, "0")}</span>}
          </div>
          {children}
        </section>
        <p className="mt-12 text-center text-xs text-muted">สร้างด้วย <span className="font-semibold text-ink">BUYKUB</span> — <Link href="/login?next=%2Fdashboard%2Fproducts%3Fcreate%3D1" className="underline underline-offset-2">เปิดร้านฟรี</Link></p>
      </div>
    </div>
  );
}
