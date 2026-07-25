import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FAQ } from "@/components/FAQ";
import { Features } from "@/components/Features";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Pricing } from "@/components/Pricing";

describe("landing page copy", () => {
  it("describes the current sign-in choices and Monday payout schedule consistently", () => {
    render(
      <>
        <Hero />
        <HowItWorks />
        <Features />
        <Pricing />
        <FAQ />
      </>,
    );

    expect(
      screen.getByText(/สมัครฟรีด้วยอีเมลหรือ Google/),
    ).toBeInTheDocument();
    expect(screen.getByText("฿330K+")).toBeInTheDocument();
    expect(screen.getAllByText(/ทุกวันจันทร์/).length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText("ทุกสัปดาห์")).not.toBeInTheDocument();
  });
});
