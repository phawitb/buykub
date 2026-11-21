import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, expect, it } from "vitest";
import { ProductPreviewGallery, PREVIEWS_SHOWN_FIRST } from "./ProductPreviewGallery";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
});

const previews = Array.from({ length: 20 }, (_, index) => ({
  id: `p${index}`, publicUrl: `https://cdn.example/${index}.png`, width: 800, height: 1100,
}));

it("shows a few samples first and the rest on request", async () => {
  render(<ProductPreviewGallery previews={previews} productName="Sheet" />);
  expect(screen.getAllByRole("button", { name: /^ดูตัวอย่าง \d+ จาก 20$/ })).toHaveLength(PREVIEWS_SHOWN_FIRST);
  await userEvent.click(screen.getByRole("button", { name: "ดูตัวอย่างทั้งหมด 20 รูป (อีก 14)" }));
  expect(screen.getAllByRole("button", { name: /^ดูตัวอย่าง \d+ จาก 20$/ })).toHaveLength(20);
  expect(screen.queryByRole("button", { name: /ดูตัวอย่างทั้งหมด/ })).not.toBeInTheDocument();
});

it("opens a sample full screen and steps through the rest", async () => {
  render(<ProductPreviewGallery previews={previews} productName="Sheet" />);
  await userEvent.click(screen.getByRole("button", { name: "ดูตัวอย่าง 2 จาก 20" }));
  const viewer = screen.getByRole("dialog", { name: "ตัวอย่าง 2 จาก 20" });
  expect(within(viewer).getByRole("img")).toHaveAttribute("src", "https://cdn.example/1.png");
  await userEvent.click(within(viewer).getAllByRole("button", { name: "รูปถัดไป" })[0]);
  expect(within(viewer).getByText("3 / 20")).toBeInTheDocument();
  fireEvent.keyDown(viewer, { key: "ArrowLeft" });
  fireEvent.keyDown(viewer, { key: "ArrowLeft" });
  fireEvent.keyDown(viewer, { key: "ArrowLeft" });
  expect(within(viewer).getByText("1 / 20")).toBeInTheDocument();
  expect(within(viewer).getAllByRole("button", { name: "รูปก่อนหน้า" })[0]).toBeDisabled();
  await userEvent.click(within(viewer).getByRole("button", { name: "ปิด" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("has no expand button when every sample already fits", () => {
  render(<ProductPreviewGallery previews={previews.slice(0, 3)} productName="Sheet" />);
  expect(screen.queryByRole("button", { name: /ดูตัวอย่างทั้งหมด/ })).not.toBeInTheDocument();
});
