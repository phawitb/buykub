import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { ProductGallery } from "./ProductGallery";

it.each([
  ["file", "ไฟล์ดิจิทัล"],
  ["course", "คอร์สเรียน"],
  ["key", "คีย์สินค้า"],
] as const)("uses the %s illustration on product details without media", (deliveryType, label) => {
  render(<ProductGallery images={[]} productName="My product" deliveryType={deliveryType} />);
  expect(screen.getByRole("img", { name: `ภาพประกอบ${label}สำหรับ My product` })).toBeInTheDocument();
});

it("shows uploaded images and keeps gallery navigation working", async () => {
  const user = userEvent.setup();
  render(<ProductGallery productName="My product" deliveryType="course" images={[
    { id: "first", path: "first.webp", publicUrl: "/first.webp", alt: "First image" },
    { id: "second", path: "second.webp", publicUrl: "/second.webp", alt: "Second image" },
  ]} />);
  expect(screen.getByRole("img", { name: "First image" })).toHaveAttribute("src", "/first.webp");
  expect(screen.queryByRole("img", { name: /ภาพประกอบ/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "ดูรูปที่ 2" }));
  expect(screen.getByRole("img", { name: "Second image" })).toHaveAttribute("src", "/second.webp");
});
