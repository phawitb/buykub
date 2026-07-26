import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProductKeyInventory } from "@/features/products/components/ProductKeyInventory";

describe("ProductKeyInventory", () => {
  it("previews unique keys and duplicate lines", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ProductKeyInventory
        value=""
        onChange={onChange}
        summary={{ available: 2, assigned: 1, disabled: 0 }}
      />,
    );

    await user.type(
      screen.getByLabelText("รายการ Product Key"),
      "KEY-1{enter}KEY-1{enter}KEY-2",
    );

    expect(onChange).toHaveBeenCalled();
    expect(screen.getByText("พร้อมขาย 2")).toBeInTheDocument();
    expect(screen.getByText("ขายแล้ว 1")).toBeInTheDocument();
  });

  it("allows only unassigned keys to change availability", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn().mockResolvedValue(undefined);
    render(
      <ProductKeyInventory
        value=""
        onChange={vi.fn()}
        summary={{ available: 1, assigned: 1, disabled: 0 }}
        records={[
          {
            id: "available",
            keyValue: "AAAA-BBBB",
            status: "available",
            assignedOrderId: null,
            createdAt: "2026-07-26",
          },
          {
            id: "assigned",
            keyValue: "CCCC-DDDD",
            status: "assigned",
            assignedOrderId: "order-1",
            createdAt: "2026-07-26",
          },
        ]}
        onStatusChange={onStatusChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "ปิดใช้ Key AAAA" }));
    expect(onStatusChange).toHaveBeenCalledWith("available", "disabled");
    expect(screen.queryByRole("button", { name: /CCCC/ })).not.toBeInTheDocument();
  });
});
