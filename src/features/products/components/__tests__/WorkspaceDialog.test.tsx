import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkspaceDialog } from "../WorkspaceDialog";
import { ProductEditor } from "../ProductEditor";

const refreshCatalog = vi.hoisted(() => vi.fn(async () => true));
const navigation = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/lib/storefront/invalidate", () => ({ invalidatePublicCatalog: refreshCatalog, CATALOG_REFRESH_WARNING: "Refresh delayed" }));
vi.mock("../RichTextEditor", () => ({ RichTextEditor: () => null }));
const value = { deliveryType: "key" as const, courseAccessDays: "", keyInput: "", keyInventory: { available: 2, assigned: 0, disabled: 0 }, name: "Guide", price: "50", comparePrice: "", category: "OTHER", descriptionHtml: "", productFile: null, images: [], highlights: [], faq: [], published: false };

beforeEach(() => {
  vi.clearAllMocks();
  refreshCatalog.mockResolvedValue(true);
  localStorage.clear();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});

it("opens a named modal and restores background scroll on unmount", () => {
  const view = render(<WorkspaceDialog label="เพิ่มสินค้า"><input aria-label="ชื่อสินค้า" /></WorkspaceDialog>);
  expect(screen.getByRole("dialog", { name: "เพิ่มสินค้า" })).toHaveAttribute("open");
  expect(screen.getByRole("textbox")).toHaveFocus();
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  expect(navigation.back).toHaveBeenCalledOnce();
  view.unmount();
  expect(document.body.style.overflow).not.toBe("hidden");
});

it("routes modal dismissal through the editor's unsaved-change guard", async () => {
  const user = userEvent.setup();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<WorkspaceDialog label="แก้ไขสินค้า"><ProductEditor mode="edit" shopId="shop" userId="owner" productId="product" existingSlugs={[]} initialValue={value} /></WorkspaceDialog>);
  await user.type(screen.getByLabelText("ชื่อสินค้า *"), " edited");
  await user.click(screen.getByRole("button", { name: "ปิดหน้าต่างสินค้า" }));
  expect(confirm).toHaveBeenCalledOnce();
  expect(navigation.push).not.toHaveBeenCalled();
  expect(navigation.back).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  confirm.mockReturnValue(true);
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/dashboard/products"));
  confirm.mockRestore();
});

it("closes the modal after a successful edit save", async () => {
  const save = vi.fn(async () => undefined);
  render(<WorkspaceDialog label="แก้ไขสินค้า"><ProductEditor mode="edit" shopId="shop" userId="owner" productId="product" existingSlugs={[]} initialValue={value} saveProduct={save} /></WorkspaceDialog>);
  await userEvent.click(screen.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }));
  await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/dashboard/products"));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: "Guide", shop_id: "shop" }));
});

it("keeps a failed edit visible inside the dialog", async () => {
  render(<WorkspaceDialog label="แก้ไขสินค้า"><ProductEditor mode="edit" shopId="shop" userId="owner" productId="product" existingSlugs={[]} initialValue={value} saveProduct={async () => { throw new Error("Save failed"); }} /></WorkspaceDialog>);
  await userEvent.click(screen.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Save failed");
  expect(navigation.push).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});


it("keeps a saved edit open when the public catalog refresh fails", async () => {
  refreshCatalog.mockResolvedValue(false);
  render(<WorkspaceDialog label="แก้ไขสินค้า"><ProductEditor mode="edit" shopId="shop" userId="owner" productId="product" existingSlugs={[]} initialValue={value} saveProduct={async () => undefined} /></WorkspaceDialog>);
  await userEvent.click(screen.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Refresh delayed");
  expect(navigation.push).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});
