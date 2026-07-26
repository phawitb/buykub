import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProductEditorValue } from "@/features/products/model";
import { ProductEditor } from "@/features/products/components/ProductEditor";
import { ProductFileUploader } from "@/features/products/components/ProductFileUploader";
import { ProductImageUploader } from "@/features/products/components/ProductImageUploader";
import type { UploadRequest, UploadResult } from "@/lib/supabase/upload";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    push,
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

const emptyValue: ProductEditorValue = {
  deliveryType: "file",
  keyInput: "",
  keyInventory: { available: 0, assigned: 0, disabled: 0 },
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

const validValue: ProductEditorValue = {
  ...emptyValue,
  name: "Saved product",
  price: "199",
  descriptionHtml: "<p>รายละเอียดทดสอบ</p>",
  productFile: {
    path: "user-123/product.zip",
    fileName: "product.zip",
    size: 100,
    mimeType: "application/zip",
  },
};

function selectContents(element: HTMLElement) {
  element.focus();
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

describe("ProductEditor", () => {
  it("cleans draft uploads left behind by an abandoned editor session", async () => {
    const deleteAsset = vi.fn().mockResolvedValue(undefined);
    window.localStorage.setItem(
      "framelink-product-draft-assets:user-123",
      JSON.stringify([
        { destination: "product-file", path: "user-123/orphan.zip" },
        { destination: "product-image", path: "user-123/orphan.webp" },
      ]),
    );

    render(
      <ProductEditor
        mode="create"
        shopId="shop-123"
        userId="user-123"
        existingSlugs={[]}
        initialValue={emptyValue}
        deleteAsset={deleteAsset}
      />,
    );

    await vi.waitFor(() => expect(deleteAsset).toHaveBeenCalledTimes(2));
    expect(deleteAsset.mock.calls).toEqual([
      ["product-file", "user-123/orphan.zip"],
      ["product-image", "user-123/orphan.webp"],
    ]);
    expect(
      window.localStorage.getItem("framelink-product-draft-assets:user-123"),
    ).toBeNull();
  });

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

  it("switches from file upload to product key inventory", async () => {
    const user = userEvent.setup();
    render(
      <ProductEditor
        mode="create"
        shopId="shop-123"
        userId="user-123"
        existingSlugs={[]}
        initialValue={emptyValue}
      />,
    );

    await user.click(screen.getByRole("radio", { name: /Product Key/ }));

    expect(
      screen.getByRole("heading", { name: "คลัง Product Key" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "ไฟล์สินค้า *" }),
    ).not.toBeInTheDocument();
  });

  it("initializes the rich editor without duplicate extensions", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <ProductEditor
        mode="create"
        shopId="shop-123"
        userId="user-123"
        existingSlugs={[]}
        initialValue={emptyValue}
      />,
    );

    expect(consoleWarn).not.toHaveBeenCalledWith(
      expect.stringContaining("Duplicate extension names"),
    );
  });

  it("opens editor popovers without nesting a form inside ProductEditor", async () => {
    const user = userEvent.setup();
    render(
      <ProductEditor
        mode="create"
        shopId="shop-123"
        userId="user-123"
        existingSlugs={[]}
        initialValue={emptyValue}
      />,
    );

    await user.click(screen.getByRole("button", { name: "เพิ่มลิงก์" }));

    expect(screen.getByRole("dialog", { name: "เพิ่มลิงก์" })).toBeInTheDocument();
    expect(document.querySelector("form form")).toBeNull();
  });

  it("keeps an edited product form open when the user cancels leaving", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <ProductEditor
        mode="create"
        shopId="shop-123"
        userId="user-123"
        existingSlugs={[]}
        initialValue={emptyValue}
      />,
    );

    await user.type(screen.getByLabelText("ชื่อสินค้า *"), "Draft product");
    await user.click(screen.getByRole("button", { name: "ยกเลิก" }));

    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByDisplayValue("Draft product")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("confirms a successful edit without navigating away", async () => {
    const user = userEvent.setup();
    const saveProduct = vi.fn().mockResolvedValue(undefined);
    render(
      <ProductEditor
        mode="edit"
        shopId="shop-123"
        userId="user-123"
        productId="product-123"
        existingSlugs={["saved-product"]}
        initialValue={{
          ...emptyValue,
          name: "Saved product",
          price: "199",
          productFile: {
            path: "user-123/product.zip",
            fileName: "product.zip",
            size: 100,
            mimeType: "application/zip",
          },
        }}
        saveProduct={saveProduct}
      />,
    );

    await user.clear(screen.getByLabelText("ชื่อสินค้า *"));
    await user.type(screen.getByLabelText("ชื่อสินค้า *"), "Updated product");
    await user.click(
      screen.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }),
    );

    expect(await screen.findByText("บันทึกสินค้าเรียบร้อยแล้ว")).toBeInTheDocument();
    expect(saveProduct).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });

  it("saves rich text toolbar HTML when creating a product", async () => {
    const user = userEvent.setup();
    const saveProduct = vi.fn().mockResolvedValue(undefined);
    render(
      <ProductEditor
        mode="create"
        shopId="shop-123"
        userId="user-123"
        existingSlugs={[]}
        initialValue={validValue}
        saveProduct={saveProduct}
      />,
    );
    const description = await screen.findByLabelText("รายละเอียดสินค้า");
    selectContents(description);

    await user.click(screen.getByRole("button", { name: "ตัวหนา" }));
    await user.click(screen.getByRole("button", { name: "สร้างสินค้า" }));

    expect(saveProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        description_html: "<p><strong>รายละเอียดทดสอบ</strong></p>",
      }),
    );
  });

  it("saves rich text toolbar HTML when editing a product", async () => {
    const user = userEvent.setup();
    const saveProduct = vi.fn().mockResolvedValue(undefined);
    render(
      <ProductEditor
        mode="edit"
        shopId="shop-123"
        userId="user-123"
        productId="product-123"
        existingSlugs={["saved-product"]}
        initialValue={validValue}
        saveProduct={saveProduct}
      />,
    );
    const description = await screen.findByLabelText("รายละเอียดสินค้า");
    selectContents(description);

    await user.click(screen.getByRole("button", { name: "ตัวเอียง" }));
    await user.click(
      screen.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }),
    );

    expect(saveProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        description_html: "<p><em>รายละเอียดทดสอบ</em></p>",
      }),
    );
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

  it("replaces progress with a complete file card after upload", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ProductFileUploader
        userId="user-123"
        value={null}
        onChange={onChange}
        uploadAsset={vi.fn(async () => ({
          path: "user-123/guide.pdf",
          publicUrl: null,
        }))}
      />,
    );

    await user.upload(
      screen.getByLabelText("เลือกไฟล์สินค้า"),
      new File(["guide"], "guide.pdf", { type: "application/pdf" }),
    );

    expect(await screen.findByText("guide.pdf")).toBeInTheDocument();
    expect(screen.getByText("อัปโหลดสำเร็จ")).toBeInTheDocument();
    expect(screen.getByLabelText("เปลี่ยนไฟล์สินค้า")).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "guide.pdf",
        path: "user-123/guide.pdf",
      }),
    );
  });
});

describe("ProductImageUploader", () => {
  it("shows byte progress independently for each product image", async () => {
    const user = userEvent.setup();
    let finishUpload: ((result: UploadResult) => void) | undefined;
    const uploadAsset = vi.fn((request: UploadRequest) => {
      request.onProgress(65, 650, 1000);
      return new Promise<UploadResult>((resolve) => {
        finishUpload = resolve;
      });
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:cover.webp");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    render(
      <ProductImageUploader
        userId="user-123"
        value={[]}
        onChange={vi.fn()}
        uploadAsset={uploadAsset}
      />,
    );

    await user.upload(
      screen.getByLabelText("เลือกรูปสินค้า"),
      new File(["cover"], "cover.webp", { type: "image/webp" }),
    );

    expect(
      await screen.findByRole("progressbar", {
        name: "กำลังอัปโหลด cover.webp",
      }),
    ).toHaveAttribute("aria-valuenow", "65");
    finishUpload?.({
      path: "user-123/cover.webp",
      publicUrl: "https://example.com/cover.webp",
    });
  });

  it("preserves every successful image when multiple uploads finish concurrently", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const uploadAsset = vi.fn(async (request: UploadRequest) => ({
      path: `user-123/${request.file.name}`,
      publicUrl: `https://example.com/${request.file.name}`,
    }));
    vi.spyOn(URL, "createObjectURL").mockImplementation(
      (file) => `blob:${(file as File).name}`,
    );
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    render(
      <ProductImageUploader
        userId="user-123"
        value={[]}
        onChange={onChange}
        uploadAsset={uploadAsset}
      />,
    );

    await user.upload(screen.getByLabelText("เลือกรูปสินค้า"), [
      new File(["one"], "one.webp", { type: "image/webp" }),
      new File(["two"], "two.webp", { type: "image/webp" }),
    ]);

    const latestImages = await vi.waitFor(() => {
      const calls = onChange.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const latest = calls[calls.length - 1][0];
      expect(latest).toHaveLength(2);
      return latest;
    });
    expect(latestImages.map((image: { publicUrl: string }) => image.publicUrl)).toEqual([
      "https://example.com/one.webp",
      "https://example.com/two.webp",
    ]);
  });
});
