import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductEditorValue } from "@/features/products/model";
import { ProductEditor } from "@/features/products/components/ProductEditor";
import { ProductFileUploader } from "@/features/products/components/ProductFileUploader";
import { ProductImageUploader } from "@/features/products/components/ProductImageUploader";
import type { UploadRequest, UploadResult } from "@/lib/supabase/upload";

const push = vi.fn();
beforeEach(() => push.mockClear());

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

async function skipPdfIntake() {
  await userEvent.click(
    screen.getByRole("button", { name: "ข้าม แล้วกรอกข้อมูลเอง" }),
  );
}

describe("ProductEditor", () => {
  it("creates courses as drafts with a duration snapshot setting and no download file", async () => {
    const saveProduct = vi.fn().mockResolvedValue(undefined);
    render(<ProductEditor mode="create" shopId="shop-123" userId="user-123" existingSlugs={[]} initialValue={{...validValue, deliveryType:"course", courseAccessDays:"90", productFile:null}} saveProduct={saveProduct}/>);
    await userEvent.click(screen.getByRole("button", {name:"สร้างคอร์สและเพิ่มบทเรียน"}));
    await vi.waitFor(() => expect(saveProduct).toHaveBeenCalledWith(expect.objectContaining({delivery_type:"course",category:"COURSE",course_access_days:90,published:false,file_path:null})));
  });

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

  it("renders the PIXZA product sequence without AI Builder", async () => {
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
    expect(screen.getByRole("heading", { name: "เริ่มจากไฟล์ PDF" })).toBeInTheDocument();
    await skipPdfIntake();
    expect(screen.queryByText("AI Builder")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ข้อมูลสินค้า" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ไฟล์สินค้า *" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "รูปสินค้า" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "จุดเด่น" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "คำถามที่พบบ่อย (FAQ)" }),
    ).toBeInTheDocument();
    // Pressable on an empty form: pressing it is how the seller is told what
    // the form still wants.
    const create = screen.getByRole("button", { name: "สร้างสินค้า" });
    expect(create).toBeEnabled();
    await userEvent.click(create);
    expect(screen.getByText("กรุณากรอกชื่อสินค้า")).toBeInTheDocument();
    expect(screen.getByText("กรุณาอัปโหลดไฟล์สินค้า")).toBeInTheDocument();
  });

  it("offers only Course and File without a second category picker", async () => {
    render(<ProductEditor mode="create" shopId="shop-123" userId="user-123" existingSlugs={[]} initialValue={emptyValue} />);
    await skipPdfIntake();

    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: /Course/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /File/ })).toBeChecked();
    expect(screen.queryByRole("button", { name: "OTHER" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Product Key/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: /Course/ }));
    expect(screen.getByRole("heading", { name: "สิทธิ์เข้าเรียน" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "ไฟล์สินค้า *" })).not.toBeInTheDocument();
  });

  it("saves how many pages the PDF has, so the storefront can say it", async () => {
    const saveProduct = vi.fn().mockResolvedValue(undefined);
    render(<ProductEditor mode="edit" shopId="shop-123" userId="user-123" productId="product-123" existingSlugs={[]} initialValue={{ ...validValue, productFile: { path: "user-123/guide.pdf", fileName: "guide.pdf", size: 2048, mimeType: "application/pdf", pageCount: 42 } }} saveProduct={saveProduct} />);

    await userEvent.click(screen.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }));
    await vi.waitFor(() => expect(saveProduct).toHaveBeenCalledWith(expect.objectContaining({ file_name: "guide.pdf", file_page_count: 42 })));
  });

  it("leaves the page count empty for a file that has no pages to count", async () => {
    const saveProduct = vi.fn().mockResolvedValue(undefined);
    render(<ProductEditor mode="edit" shopId="shop-123" userId="user-123" productId="product-123" existingSlugs={[]} initialValue={validValue} saveProduct={saveProduct} />);

    await userEvent.click(screen.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }));
    await vi.waitFor(() => expect(saveProduct).toHaveBeenCalledWith(expect.objectContaining({ file_page_count: null })));
  });

  it.each(["create", "edit"] as const)("saves the File category from its delivery type in %s mode", async (mode) => {
    const saveProduct = vi.fn().mockResolvedValue(undefined);
    render(<ProductEditor mode={mode} shopId="shop-123" userId="user-123" productId={mode === "edit" ? "product-123" : undefined} existingSlugs={[]} initialValue={{ ...validValue, category: "GUIDE" }} saveProduct={saveProduct} />);

    await userEvent.click(screen.getByRole("button", { name: mode === "create" ? "สร้างสินค้า" : "บันทึกการเปลี่ยนแปลง" }));
    await vi.waitFor(() => expect(saveProduct).toHaveBeenCalledWith(expect.objectContaining({ category: "FILE", delivery_type: "file", file_path: "user-123/product.zip" })));
  });

  it("updates the saved category when switching from File to Course", async () => {
    const saveProduct = vi.fn().mockResolvedValue(undefined);
    render(<ProductEditor mode="create" shopId="shop-123" userId="user-123" existingSlugs={[]} initialValue={validValue} saveProduct={saveProduct} />);

    await userEvent.click(screen.getByRole("radio", { name: /Course/ }));
    await userEvent.click(screen.getByRole("button", { name: "สร้างคอร์สและเพิ่มบทเรียน" }));
    await vi.waitFor(() => expect(saveProduct).toHaveBeenCalledWith(expect.objectContaining({ category: "COURSE", delivery_type: "course", published: false, file_path: null })));
  });

  it("saves a course's companion PDF with the course", async () => {
    const saveProduct = vi.fn().mockResolvedValue(undefined);
    const pdf = { path: "user-123/course.pdf", fileName: "Course.pdf", size: 2048, mimeType: "application/pdf", pageCount: 12 };
    render(<ProductEditor mode="edit" shopId="shop-123" userId="user-123" productId="course-1" existingSlugs={[]} initialValue={{ ...validValue, deliveryType: "course", productFile: pdf }} saveProduct={saveProduct} />);

    expect(screen.getByRole("heading", { name: "ไฟล์ PDF ประกอบคอร์ส" })).toBeInTheDocument();
    expect(screen.getByText("Course.pdf")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }));
    await vi.waitFor(() => expect(saveProduct).toHaveBeenCalledWith(expect.objectContaining({ delivery_type: "course", file_path: "user-123/course.pdf", file_name: "Course.pdf", file_mime_type: "application/pdf", file_page_count: 12 })));
  });

  it("preserves legacy key delivery, stock controls, and key import while using the File category", async () => {
    const saveProduct = vi.fn().mockResolvedValue(undefined);
    render(<ProductEditor mode="edit" shopId="shop-123" userId="user-123" productId="key-product" existingSlugs={[]} initialValue={{ ...validValue, deliveryType: "key", productFile: null, keyInventory: { available: 2, assigned: 1, disabled: 0 } }} initialKeyRecords={[{ id: "key-1", keyValue: "TEST-KEY-1234", status: "available", assignedOrderId: null, createdAt: "2026-11-12" }]} saveProduct={saveProduct} />);

    expect(screen.getByRole("heading", { name: "คลัง Product Key" })).toBeInTheDocument();
    expect(screen.getByText("พร้อมขาย 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ปิดใช้ Key TEST" })).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "รายการ Product Key" }), "NEW-KEY-5678");
    await userEvent.click(screen.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }));

    await vi.waitFor(() => expect(saveProduct).toHaveBeenCalledWith(expect.objectContaining({ category: "FILE", delivery_type: "key", product_keys: ["NEW-KEY-5678"], file_path: null })));
    expect(await screen.findByText("พร้อมขาย 3")).toBeInTheDocument();
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

    await skipPdfIntake();
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

    await skipPdfIntake();
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

vi.mock("@/lib/storefront/invalidate", () => ({ invalidatePublicCatalog: vi.fn(async () => true), CATALOG_REFRESH_WARNING: "Refresh delayed" }));

describe("ProductEditor refusals", () => {
  it("says why it will not save instead of leaving the button dead", async () => {
    const saveProduct = vi.fn().mockResolvedValue(undefined);
    render(
      <ProductEditor
        mode="create"
        shopId="shop-123"
        userId="user-123"
        existingSlugs={[]}
        initialValue={{ ...validValue, price: "998", comparePrice: "590" }}
        saveProduct={saveProduct}
      />,
    );

    // A seller who raised the price past the old one had no way to find out:
    // the button went grey and the reason was only ever shown on submit.
    const button = screen.getByRole("button", { name: "สร้างสินค้า" });
    expect(button).toBeEnabled();

    await userEvent.click(button);
    expect(screen.getByText("ราคาเดิมต้องมากกว่าราคาขาย")).toBeInTheDocument();
    expect(saveProduct).not.toHaveBeenCalled();

    const comparePrice = screen.getByLabelText(/ราคาเดิม/);
    expect(comparePrice).toHaveAttribute("aria-invalid", "true");
    expect(comparePrice).toHaveFocus();

    // And the message goes as soon as the mistake does, without a second press.
    await userEvent.clear(comparePrice);
    await userEvent.type(comparePrice, "1290");
    expect(
      screen.queryByText("ราคาเดิมต้องมากกว่าราคาขาย"),
    ).not.toBeInTheDocument();

    await userEvent.click(button);
    await vi.waitFor(() => expect(saveProduct).toHaveBeenCalledTimes(1));
  });
});

describe("preview images", () => {
  const preview = { id: "p", path: "user-123/p.png", publicUrl: "https://cdn.example/p.png", width: 800, height: 600, blur: false, watermark: true };

  it("saves the sample images with the product", async () => {
    const saveProduct = vi.fn().mockResolvedValue(undefined);
    render(<ProductEditor mode="edit" shopId="shop-123" userId="user-123" productId="p-1" existingSlugs={[]} initialValue={{ ...validValue, previews: [preview] }} saveProduct={saveProduct} />);
    expect(screen.getByRole("heading", { name: "รูปตัวอย่าง (Preview)" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }));
    await vi.waitFor(() => expect(saveProduct).toHaveBeenCalledWith(expect.objectContaining({ preview_images: [preview] })));
  });

  it("refuses to drop samples on a database that cannot store them yet", async () => {
    const saveProduct = vi.fn().mockRejectedValue({ code: "PGRST204", message: "Could not find the 'preview_images' column" });
    render(<ProductEditor mode="edit" shopId="shop-123" userId="user-123" productId="p-1" existingSlugs={[]} initialValue={{ ...validValue, previews: [preview] }} saveProduct={saveProduct} />);
    await userEvent.click(screen.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }));
    expect(await screen.findByText(/ระบบยังไม่พร้อมบันทึกรูปตัวอย่าง/)).toBeInTheDocument();
    expect(saveProduct).toHaveBeenCalledTimes(1);
  });

  it("saves a product without samples on such a database by leaving the column out", async () => {
    const saveProduct = vi.fn()
      .mockRejectedValueOnce({ code: "PGRST204", message: "Could not find the 'preview_images' column" })
      .mockResolvedValue(undefined);
    render(<ProductEditor mode="edit" shopId="shop-123" userId="user-123" productId="p-1" existingSlugs={[]} initialValue={validValue} saveProduct={saveProduct} />);
    await userEvent.click(screen.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }));
    await vi.waitFor(() => expect(saveProduct).toHaveBeenCalledTimes(2));
    expect(saveProduct.mock.calls[1][0]).not.toHaveProperty("preview_images");
  });
});
