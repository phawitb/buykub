import { SiteNav } from "@/components/SiteNav";
import { Hero } from "@/components/Hero";
import { SellableGrid } from "@/components/SellableGrid";
import { StepsBand } from "@/components/StepsBand";
import { PaymentLinkBand } from "@/components/PaymentLinkBand";
import { Testimonials } from "@/components/Testimonials";
import { Pricing } from "@/components/Pricing";
import { FAQ } from "@/components/FAQ";
import { ClosingCTA } from "@/components/ClosingCTA";
import { Footer } from "@/components/Footer";
import { ShopPromo } from "@/components/ShopPromo";
import { getPublicSiteSettings } from "@/lib/admin/site";

/**
 * Photographs: free Unsplash License, credited in
 * `public/images/landing/credits.json` and `docs/licenses/landing-panels.md`.
 */
export default async function Home() {
  const ctaHref = "/dashboard/products?create=1";
  const site = await getPublicSiteSettings();

  return (
    <div className="flex flex-1 flex-col">
      <SiteNav liveAccount />

      {site.announcement && (
        <div role="note" className="border-b border-line bg-accent-soft px-6 py-3 text-center text-sm text-ink">
          {site.announcement}
        </div>
      )}

      <main className="flex-1">
        <Hero ctaHref={ctaHref} title={site.hero_title} subtitle={site.hero_subtitle} />
        <SellableGrid ctaHref={ctaHref} />
        <StepsBand />
        <PaymentLinkBand />
        <Testimonials />
        <Pricing />
        <FAQ />
        <ClosingCTA ctaHref={ctaHref} />
      </main>

      <Footer supportEmail={site.support_email} />
      <ShopPromo />
    </div>
  );
}
