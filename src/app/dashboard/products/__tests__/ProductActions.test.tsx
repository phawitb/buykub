import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProductActions } from "@/app/dashboard/products/ProductActions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("ProductActions", () => {
  it("deletes private files and product images after deleting the product row", async () => {
    const user = userEvent.setup();
    const deleteProduct = vi.fn().mockResolvedValue(undefined);
    const deleteAsset = vi.fn().mockResolvedValue(undefined);
    render(
      <ProductActions
        productId="product-1"
        shopId="shop-1"
        productName="QA product"
        published
        assets={[
          { destination: "product-file", path: "user/product.zip" },
          { destination: "product-image", path: "user/cover.webp" },
        ]}
        deleteProduct={deleteProduct}
        deleteAsset={deleteAsset}
      />,
    );

    await user.click(screen.getByRole("button", { name: "ลบสินค้า" }));
    await user.click(
      screen.getByRole("dialog").querySelector("button:last-child")!,
    );

    expect(deleteProduct).toHaveBeenCalledOnce();
    expect(deleteAsset.mock.calls.map(([destination, path]) => [destination, path])).toEqual([
      ["product-file", "user/product.zip"],
      ["product-image", "user/cover.webp"],
    ]);
  });

  it("explains that a product with orders is unpublished instead, and keeps its files", async () => {
    const user = userEvent.setup();
    const deleteProduct = vi.fn().mockRejectedValue({ code: "23503", message: "violates foreign key constraint" });
    const deleteAsset = vi.fn();
    render(
      <ProductActions
        productId="product-1"
        shopId="shop-1"
        productName="QA product"
        published
        assets={[{ destination: "product-file", path: "user/product.zip" }]}
        deleteProduct={deleteProduct}
        deleteAsset={deleteAsset}
      />,
    );

    await user.click(screen.getByRole("button", { name: "ลบสินค้า" }));
    await user.click(screen.getByRole("dialog").querySelector("button:last-child")!);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(/ลบสินค้าไม่ได้ เพราะมีคำสั่งซื้อแล้ว/)).toHaveTextContent("ยกเลิกเผยแพร่");
    expect(deleteAsset).not.toHaveBeenCalled();
  });

  it("shows the database message for other failures", async () => {
    const user = userEvent.setup();
    render(
      <ProductActions
        productId="product-1"
        shopId="shop-1"
        productName="QA product"
        published={false}
        assets={[]}
        deleteProduct={vi.fn().mockRejectedValue({ code: "42501", message: "permission denied" })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "ลบสินค้า" }));
    await user.click(screen.getByRole("dialog").querySelector("button:last-child")!);

    expect(screen.getByText("ลบสินค้าไม่สำเร็จ: permission denied")).toBeInTheDocument();
  });
});

vi.mock("@/lib/storefront/invalidate", () => ({ invalidatePublicCatalog: vi.fn(async () => true), CATALOG_REFRESH_WARNING: "Refresh delayed" }));
