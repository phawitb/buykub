import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { ProductGallery } from "./ProductGallery";

const pages = [
  { id: "first", path: "first.webp", publicUrl: "/first.webp", alt: "First image" },
  { id: "second", path: "second.webp", publicUrl: "/second.webp", alt: "Second image" },
  { id: "third", path: "third.webp", publicUrl: "/third.webp", alt: "Third image" },
];

it.each([
  ["file", "ไฟล์ดิจิทัล"],
  ["course", "คอร์สเรียน"],
  ["key", "คีย์สินค้า"],
] as const)("uses the %s illustration on product details without media", (deliveryType, label) => {
  render(<ProductGallery images={[]} productName="My product" deliveryType={deliveryType} />);
  expect(screen.getByRole("img", { name: `ภาพประกอบ${label}สำหรับ My product` })).toBeInTheDocument();
});

it("lays every image out in one swipeable track", () => {
  render(<ProductGallery productName="My product" deliveryType="course" images={pages} />);

  expect(screen.getByRole("img", { name: "First image" })).toHaveAttribute("src", "/first.webp");
  expect(screen.getByRole("img", { name: "Third image" })).toHaveAttribute("src", "/third.webp");
  expect(screen.queryByRole("img", { name: /ภาพประกอบ/ })).not.toBeInTheDocument();
});

it("says which image of how many the buyer is looking at", async () => {
  const user = userEvent.setup();
  render(<ProductGallery productName="My product" deliveryType="course" images={pages} />);

  expect(screen.getByText("1 / 3")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "ดูรูปที่ 3" }));
  expect(screen.getByText("3 / 3")).toBeInTheDocument();
});

it("marks the dot of the image on screen", async () => {
  const user = userEvent.setup();
  render(<ProductGallery productName="My product" deliveryType="course" images={pages} />);

  expect(screen.getByRole("button", { name: "ดูรูปที่ 1" })).toHaveAttribute("aria-current", "true");
  await user.click(screen.getByRole("button", { name: "ดูรูปที่ 2" }));
  expect(screen.getByRole("button", { name: "ดูรูปที่ 2" })).toHaveAttribute("aria-current", "true");
  expect(screen.getByRole("button", { name: "ดูรูปที่ 1" })).toHaveAttribute("aria-current", "false");
});

it("moves one image at a time and stops at the ends", async () => {
  const user = userEvent.setup();
  render(<ProductGallery productName="My product" deliveryType="course" images={pages} />);

  expect(screen.getByRole("button", { name: "รูปก่อนหน้า" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "รูปถัดไป" }));
  expect(screen.getByText("2 / 3")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "รูปถัดไป" }));
  expect(screen.getByText("3 / 3")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "รูปถัดไป" })).toBeDisabled();
});

it("turns the page with the arrow keys", async () => {
  const user = userEvent.setup();
  render(<ProductGallery productName="My product" deliveryType="course" images={pages} />);

  await user.click(screen.getByRole("group", { name: "รูปสินค้า My product" }));
  await user.keyboard("{ArrowRight}{ArrowRight}");
  expect(screen.getByText("3 / 3")).toBeInTheDocument();
  await user.keyboard("{ArrowLeft}");
  expect(screen.getByText("2 / 3")).toBeInTheDocument();
});

it("leaves a single image without controls to work", () => {
  render(<ProductGallery productName="My product" deliveryType="course" images={[pages[0]]} />);

  expect(screen.getByRole("img", { name: "First image" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "ดูรูปที่ 1" })).not.toBeInTheDocument();
  expect(screen.queryByText("1 / 1")).not.toBeInTheDocument();
});

it("counts the sample page against the length of the whole file", async () => {
  const user = userEvent.setup();
  render(
    <ProductGallery
      productName="My product"
      deliveryType="file"
      images={pages}
      filePageCount={42}
    />,
  );

  // "1 / 3" would read as a three-page product; the file's own length is the
  // number the buyer is paying for.
  expect(screen.getByText("1 / 42")).toBeInTheDocument();
  expect(screen.queryByText("1 / 3")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "ดูรูปที่ 3" }));
  expect(screen.getByText("3 / 42")).toBeInTheDocument();
});

it("ends the sample on a sheet standing for the pages it does not show", async () => {
  const user = userEvent.setup();
  render(
    <ProductGallery
      productName="My product"
      deliveryType="file"
      images={pages}
      filePageCount={42}
    />,
  );

  expect(screen.getByText("+39")).toBeInTheDocument();
  expect(screen.getByText(/ที่เหลือในไฟล์ฉบับเต็ม/)).toBeInTheDocument();

  // The closing sheet is reachable the same way a page is, and numbers nothing.
  await user.click(screen.getByRole("button", { name: "ดูหน้าที่เหลืออีก 39 หน้า" }));
  expect(screen.getByText("ทั้งหมด 42 หน้า")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "รูปถัดไป" })).toBeDisabled();
});

it("gives a one-page sample the controls it now needs", () => {
  render(
    <ProductGallery
      productName="My product"
      deliveryType="file"
      images={[pages[0]]}
      filePageCount={12}
    />,
  );

  expect(screen.getByText("1 / 12")).toBeInTheDocument();
  expect(screen.getByText("+11")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "ดูรูปที่ 1" })).toBeInTheDocument();
});

it("says the length outright when the sample is the whole file", () => {
  render(
    <ProductGallery
      productName="My product"
      deliveryType="file"
      images={pages}
      filePageCount={3}
    />,
  );

  expect(screen.getByText("ไฟล์นี้มีทั้งหมด 3 หน้า")).toBeInTheDocument();
  expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
});

it("says nothing about pages for a product that is not a PDF", () => {
  render(<ProductGallery productName="My product" deliveryType="course" images={pages} />);

  expect(screen.getByText("1 / 3")).toBeInTheDocument();
  expect(screen.queryByText(/หน้า$/)).not.toBeInTheDocument();
});
