import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { ProductDraftProvider } from "../ProductDraftProvider";
import { ProductEditor } from "../ProductEditor";
import type { ProductEditorProps } from "../ProductEditor";

const mocks = vi.hoisted(() => ({ push: vi.fn(), deleteAsset: vi.fn(async () => undefined), upload: vi.fn(async () => ({ path: "owner/draft.pdf", publicUrl: "https://example.com/draft.pdf" })) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/upload", () => ({ deleteShopAsset: mocks.deleteAsset, uploadShopAsset: mocks.upload }));
vi.mock("@/lib/storefront/invalidate", () => ({ invalidatePublicCatalog: async () => true, CATALOG_REFRESH_WARNING: "Refresh delayed" }));
vi.mock("../RichTextEditor", () => ({ RichTextEditor: () => null }));
const initialValue = { deliveryType: "file" as const, courseAccessDays: "", keyInput: "", keyInventory: { available: 0, assigned: 0, disabled: 0 }, name: "Saved name", price: "50", comparePrice: "", category: "OTHER", descriptionHtml: "", productFile: null, images: [], highlights: [], faq: [], published: false };
const props: ProductEditorProps = { mode: "edit", userId: "owner", shopId: "shop", productId: "product-a", existingSlugs: [], initialValue };
function Workspace({ editor }: { editor?: ProductEditorProps }) { return <ProductDraftProvider>{editor && <ProductEditor {...editor} />}</ProductDraftProvider>; }

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

it("restores unsaved values after Back/Forward remount without writing key text to storage", async () => {
  const keyProps = { ...props, initialValue: { ...initialValue, deliveryType: "key" as const } };
  const view = render(<Workspace editor={keyProps} />);
  await userEvent.type(screen.getByLabelText("ชื่อสินค้า *"), " draft");
  const keyInput = screen.getByRole("textbox", { name: /รายการ Product Key/ });
  await userEvent.type(keyInput, "PRIVATE-NEW-KEY");
  view.rerender(<Workspace />);
  view.rerender(<Workspace editor={keyProps} />);
  expect(screen.getByLabelText("ชื่อสินค้า *")).toHaveValue("Saved name draft");
  expect(screen.getByRole("textbox", { name: /รายการ Product Key/ })).toHaveValue("PRIVATE-NEW-KEY");
  expect(JSON.stringify(localStorage)).not.toContain("PRIVATE-NEW-KEY");
});

it("protects uploaded assets in every retained draft when another product is opened", async () => {
  const view = render(<Workspace editor={props} />);
  await userEvent.upload(screen.getByLabelText("เลือกไฟล์สินค้า"), new File(["file"], "draft.pdf", { type: "application/pdf" }));
  await screen.findByText("draft.pdf");
  view.rerender(<Workspace />);
  view.rerender(<Workspace editor={{ ...props, productId: "product-b" }} />);
  expect(screen.queryByText("draft.pdf")).not.toBeInTheDocument();
  expect(mocks.deleteAsset).not.toHaveBeenCalled();
  view.rerender(<Workspace />);
  view.rerender(<Workspace editor={props} />);
  expect(screen.getByText("draft.pdf")).toBeInTheDocument();
  expect(mocks.deleteAsset).not.toHaveBeenCalled();
});

it("keeps drafts isolated by account, shop, product, and creation scope", async () => {
  const view = render(<Workspace editor={props} />);
  await userEvent.type(screen.getByLabelText("ชื่อสินค้า *"), " private");
  for (const other of [{ ...props, userId: "other" }, { ...props, shopId: "other-shop" }, { ...props, productId: "product-b" }, { ...props, mode: "create" as const, productId: undefined }]) {
    view.rerender(<Workspace editor={other} />);
    expect(screen.getByLabelText("ชื่อสินค้า *")).toHaveValue("Saved name");
  }
  view.rerender(<Workspace editor={props} />);
  expect(screen.getByLabelText("ชื่อสินค้า *")).toHaveValue("Saved name private");
});

it("explicit discard clears the draft and cleans its uploaded assets", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  const view = render(<Workspace editor={props} />);
  await userEvent.upload(screen.getByLabelText("เลือกไฟล์สินค้า"), new File(["file"], "draft.pdf", { type: "application/pdf" }));
  await screen.findByText("draft.pdf");
  await userEvent.type(screen.getByLabelText("ชื่อสินค้า *"), " discarded");
  await userEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/dashboard/products"));
  expect(mocks.deleteAsset).toHaveBeenCalledWith("product-file", "owner/draft.pdf");
  view.rerender(<Workspace />);
  view.rerender(<Workspace editor={props} />);
  expect(screen.getByLabelText("ชื่อสินค้า *")).toHaveValue("Saved name");
  expect(screen.queryByText("draft.pdf")).not.toBeInTheDocument();
  confirm.mockRestore();
});

it("successful save clears its draft without deleting newly committed uploads", async () => {
  const savedProps = { ...props, saveProduct: async () => undefined };
  const view = render(<Workspace editor={savedProps} />);
  await userEvent.upload(screen.getByLabelText("เลือกไฟล์สินค้า"), new File(["file"], "draft.pdf", { type: "application/pdf" }));
  await screen.findByText("draft.pdf");
  await userEvent.type(screen.getByLabelText("ชื่อสินค้า *"), " saved");
  await userEvent.click(screen.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }));
  await screen.findByRole("status");
  view.rerender(<Workspace />);
  view.rerender(<Workspace editor={props} />);
  expect(screen.getByLabelText("ชื่อสินค้า *")).toHaveValue("Saved name");
  expect(mocks.deleteAsset).not.toHaveBeenCalled();
});
