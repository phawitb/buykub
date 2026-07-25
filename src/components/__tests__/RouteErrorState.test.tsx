import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RouteErrorState } from "@/components/RouteErrorState";

describe("RouteErrorState", () => {
  it("lets the visitor retry the failed route", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();

    render(<RouteErrorState reset={reset} />);
    await user.click(screen.getByRole("button", { name: "ลองอีกครั้ง" }));

    expect(reset).toHaveBeenCalledOnce();
  });

  it("supports dashboard-specific recovery copy", () => {
    render(<RouteErrorState reset={vi.fn()} variant="dashboard" />);

    expect(
      screen.getByRole("heading", { name: "โหลดข้อมูลหลังร้านไม่สำเร็จ" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "กลับหน้าหลังร้าน" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });
});
