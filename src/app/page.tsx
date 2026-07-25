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

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Navbar />
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
