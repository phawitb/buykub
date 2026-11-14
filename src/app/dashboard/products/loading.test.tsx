import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProductsLoading from "./loading";

describe("ProductsLoading", () => {
  it("announces the loading state and reserves product-row space", () => {
    render(<ProductsLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("กำลังโหลดร้านค้าของฉัน");
    expect(screen.getAllByTestId("product-row-skeleton")).toHaveLength(3);
  });
});
