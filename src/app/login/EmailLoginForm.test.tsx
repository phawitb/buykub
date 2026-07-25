import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmailLoginForm } from "./EmailLoginForm";

describe("EmailLoginForm", () => {
  it("sends a normalized magic link and confirms where to check", async () => {
    const user = userEvent.setup();
    const sendMagicLink = vi.fn().mockResolvedValue(undefined);
    render(
      <EmailLoginForm
        next="/dashboard/settings"
        sendMagicLink={sendMagicLink}
      />,
    );

    const submit = screen.getByRole("button", {
      name: "ส่งลิงก์เข้าสู่ระบบ",
    });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("อีเมล"), " USER@EXAMPLE.COM ");
    await user.click(submit);

    expect(sendMagicLink).toHaveBeenCalledWith("user@example.com");
    expect(screen.getByRole("status")).toHaveTextContent(
      "ส่งลิงก์เข้าสู่ระบบไปที่ user@example.com แล้ว",
    );
  });

  it("shows a retryable error when Supabase cannot send the link", async () => {
    const user = userEvent.setup();
    render(
      <EmailLoginForm
        next="/dashboard"
        sendMagicLink={vi.fn().mockRejectedValue(new Error("ส่งอีเมลไม่สำเร็จ"))}
      />,
    );

    await user.type(screen.getByLabelText("อีเมล"), "user@example.com");
    await user.click(
      screen.getByRole("button", { name: "ส่งลิงก์เข้าสู่ระบบ" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ส่งอีเมลไม่สำเร็จ",
    );
    expect(
      screen.getByRole("button", { name: "ส่งลิงก์เข้าสู่ระบบ" }),
    ).toBeEnabled();
  });
});
