import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { BookingTabs } from "@/app/dashboard/bookings/BookingTabs";

describe("BookingTabs", () => {
  it("switches between services and incoming bookings without leaving the page", async () => {
    const user = userEvent.setup();
    render(
      <BookingTabs
        services={<p>Service list</p>}
        incoming={<p>Incoming list</p>}
      />,
    );

    expect(screen.getByText("Service list")).toBeVisible();
    expect(screen.queryByText("Incoming list")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "การจองที่เข้ามา" }));

    expect(screen.getByText("Incoming list")).toBeVisible();
    expect(screen.queryByText("Service list")).not.toBeInTheDocument();
  });
});
