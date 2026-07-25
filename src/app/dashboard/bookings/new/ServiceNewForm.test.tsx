import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ServiceNewForm } from "./ServiceNewForm";
import type { UploadRequest, UploadResult } from "@/lib/supabase/upload";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("ServiceNewForm", () => {
  it("shows byte progress while a service image uploads", async () => {
    const user = userEvent.setup();
    let finishUpload: ((result: UploadResult) => void) | undefined;
    const uploadAsset = vi.fn((request: UploadRequest) => {
      request.onProgress(57, 570, 1000);
      return new Promise<UploadResult>((resolve) => {
        finishUpload = resolve;
      });
    });

    render(
      <ServiceNewForm
        shopId="shop-1"
        userId="user-1"
        uploadAsset={uploadAsset}
      />,
    );

    await user.upload(
      screen.getByLabelText("รูปบริการ"),
      new File(["image"], "service.webp", { type: "image/webp" }),
    );

    expect(
      await screen.findByRole("progressbar", {
        name: "กำลังอัปโหลดรูปบริการ",
      }),
    ).toHaveAttribute("aria-valuenow", "57");
    expect(screen.getByText("57%")).toBeInTheDocument();

    finishUpload?.({
      path: "user-1/service.webp",
      publicUrl: "https://example.com/service.webp",
    });
  });

  it("pre-fills edit values and exposes PIXZA-style buffer chips", () => {
    render(
      <ServiceNewForm
        shopId="shop-1"
        userId="user-1"
        serviceId="service-1"
        initialValues={{
          name: "ปรึกษา 1:1",
          price_cents: 99000,
          duration_minutes: 60,
          description: "คุยแบบส่วนตัว",
          image_url: null,
          meet_link: null,
          availability: {
            days: [1, 3, 5],
            start: "10:00",
            end: "17:00",
            buffer_minutes: 30,
            advance_days: 14,
          },
        }}
      />,
    );

    expect(screen.getByDisplayValue("ปรึกษา 1:1")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("button", { name: "30 นาที" })
        .some((button) => button.classList.contains("bg-ink")),
    ).toBe(true);
    expect(screen.getByRole("button", { name: "บันทึกการแก้ไข" })).toBeInTheDocument();
  });
});
