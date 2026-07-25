import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProductEditorValue } from "@/features/products/model";
import { ProductEditor } from "@/features/products/components/ProductEditor";
import { ProductFileUploader } from "@/features/products/components/ProductFileUploader";
import type { UploadRequest, UploadResult } from "@/lib/supabase/upload";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

const emptyValue: ProductEditorValue = {
  name: "",
  price: "",
  comparePrice: "",
  category: "OTHER",
  descriptionHtml: "",
  productFile: null,
  images: [],
  highlights: [],
  faq: [],
  published: true,
};

describe("ProductEditor", () => {
  it("renders the PIXZA product sequence without AI Builder", () => {
    render(
      <ProductEditor
        mode="create"
        shopId="shop-123"
        userId="user-123"
        existingSlugs={[]}
        initialValue={emptyValue}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "สร้างสินค้าใหม่" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("AI Builder")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ข้อมูลสินค้า" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ไฟล์สินค้า *" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "รูปสินค้า" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "จุดเด่น" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "คำถามที่พบบ่อย (FAQ)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "สร้างสินค้า" })).toBeDisabled();
  });
});

describe("ProductFileUploader", () => {
  it("shows transmitted byte progress while the product file uploads", async () => {
    const user = userEvent.setup();
    let finishUpload: ((result: UploadResult) => void) | undefined;
    const uploadAsset = vi.fn((request: UploadRequest) => {
      request.onProgress(42, 420, 1000);
      return new Promise<UploadResult>((resolve) => {
        finishUpload = resolve;
      });
    });

    render(
      <ProductFileUploader
        userId="user-123"
        value={null}
        onChange={vi.fn()}
        uploadAsset={uploadAsset}
      />,
    );

    await user.upload(
      screen.getByLabelText("เลือกไฟล์สินค้า"),
      new File(["content"], "product.zip", { type: "application/zip" }),
    );

    expect(
      await screen.findByRole("progressbar", {
        name: "กำลังอัปโหลดไฟล์สินค้า",
      }),
    ).toHaveAttribute("aria-valuenow", "42");
    expect(screen.getByText("42%")).toBeInTheDocument();

    finishUpload?.({ path: "user-123/file.zip", publicUrl: null });
  });
});
