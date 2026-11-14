import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteNav } from "../SiteNav";
import { Footer } from "../Footer";
import { LegalPage } from "../LegalPage";

vi.mock("../ProfileMenu", () => ({ ProfileMenu: () => <span>Account menu</span> }));
vi.mock("../LandingAccount", () => ({ LandingAccount: () => <span>Live account</span> }));

describe("public brand navigation", () => {
  it.each([null, { name: "Seller", avatarUrl: null }])("always links the navbar logo to the landing page", user => {
    render(<SiteNav user={user} />);
    expect(screen.getByRole("link", { name: "BUYKUB" })).toHaveAttribute("href", "/");
  });

  it("keeps the same destination in the footer and legal page", () => {
    render(<><Footer /><LegalPage title="ข้อมูล" updatedAt="2026"><p>Details</p></LegalPage></>);
    for (const logo of screen.getAllByRole("link", { name: "BUYKUB" })) {
      expect(logo).toHaveAttribute("href", "/");
    }
  });
});
