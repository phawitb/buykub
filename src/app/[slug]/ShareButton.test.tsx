import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ShareButton } from "./ShareButton";

const writeText = vi.fn();
beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  window.history.replaceState({}, "", "/dashboard/products?token=private");
});
afterEach(() => {
  window.history.replaceState({}, "", "/");
  Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
});

it("shares the supplied public URL through native sharing", async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "share", { configurable: true, value: share });
  render(<ShareButton url="https://buykub.com/demo" title="Demo shop" label="แชร์ร้าน" />);
  fireEvent.click(screen.getByRole("button", { name: "แชร์ร้าน" }));
  await waitFor(() => expect(share).toHaveBeenCalledWith({ url: "https://buykub.com/demo", title: "Demo shop" }));
  expect(writeText).not.toHaveBeenCalled();
});

it("copies the supplied URL without dashboard paths or query tokens when native share is unavailable", async () => {
  render(<ShareButton url="https://buykub.com/demo/guide" title="Guide" label="แชร์สินค้า" />);
  fireEvent.click(screen.getByRole("button", { name: "แชร์สินค้า" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://buykub.com/demo/guide"));
  expect(await screen.findByRole("status")).toHaveTextContent("คัดลอกลิงก์แล้ว");
});

it("treats cancelling native sharing as a cancellation without copying", async () => {
  Object.defineProperty(navigator, "share", { configurable: true, value: vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")) });
  render(<ShareButton url="https://buykub.com/demo" title="Demo" label="แชร์ร้าน" />);
  fireEvent.click(screen.getByRole("button", { name: "แชร์ร้าน" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "แชร์ร้าน" })).not.toBeDisabled());
  expect(writeText).not.toHaveBeenCalled();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("falls back to copying if the native share service fails", async () => {
  Object.defineProperty(navigator, "share", { configurable: true, value: vi.fn().mockRejectedValue(new Error("Unavailable")) });
  render(<ShareButton url="https://buykub.com/demo" title="Demo" label="แชร์ร้าน" />);
  fireEvent.click(screen.getByRole("button", { name: "แชร์ร้าน" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://buykub.com/demo"));
});

it("offers a selectable public link when clipboard access is denied", async () => {
  writeText.mockRejectedValue(new Error("Permission denied"));
  render(<ShareButton url="https://buykub.com/demo" title="Demo" label="แชร์ร้าน" />);
  fireEvent.click(screen.getByRole("button", { name: "แชร์ร้าน" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("คัดลอกลิงก์ไม่สำเร็จ");
  const link = screen.getByRole("textbox", { name: "ลิงก์สำหรับแชร์" });
  expect(link).toHaveValue("https://buykub.com/demo");
  expect(link).toHaveAttribute("readonly");
});
