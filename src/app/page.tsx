import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { AudienceMarquee } from "@/components/AudienceMarquee";
import { HowItWorks } from "@/components/HowItWorks";
import { Features } from "@/components/Features";
import { WhyUs } from "@/components/WhyUs";
import { FeaturedShops } from "@/components/FeaturedShops";
import { Testimonial } from "@/components/Testimonial";
import { Pricing } from "@/components/Pricing";
import { FAQ } from "@/components/FAQ";
import { ClosingCTA } from "@/components/ClosingCTA";
import { Footer } from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const navUser = user
    ? {
        name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "",
        avatarUrl: user.user_metadata?.avatar_url ?? null,
      }
    : null;

  return (
    <div className="flex flex-1 flex-col">
      <Navbar user={navUser} />
      <main className="flex-1">
        <Hero />
        <AudienceMarquee />
        <HowItWorks />
        <Features />
        <WhyUs />
        <FeaturedShops />
        <Testimonial />
        <Pricing />
        <FAQ />
        <ClosingCTA />
      </main>
      <Footer />
    </div>
  );
}
