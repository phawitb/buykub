import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Hero } from "../Hero";
import { Footer } from "../Footer";

it("renders managed text as text and exposes the configured website contact", () => {
  const { container } = render(<><Hero title={"ความรู้ของคุณ\nส่งต่อได้"} subtitle={"<script>bad()</script>"}/><Footer supportEmail="hello@example.com"/></>);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("ความรู้ของคุณ");
  expect(screen.getByText("<script>bad()</script>")).toBeInTheDocument();
  expect(container.querySelector("script")).toBeNull();
  expect(screen.getByRole("link", { name: "hello@example.com" })).toHaveAttribute("href", "mailto:hello@example.com");
});
