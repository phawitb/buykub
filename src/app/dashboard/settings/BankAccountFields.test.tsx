import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { BankAccountFields } from "./BankAccountFields";
import type { BankDetails } from "./thai-banks";

describe("BankAccountFields", () => {
  it("opens a searchable picker and selects a Thai bank", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <BankAccountFields
        value={{ bankCode: "", accountNumber: "", accountName: "", legacy: "" }}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "เลือกธนาคาร" }));
    expect(
      screen.getByRole("dialog", { name: "เลือกธนาคารรับเงิน" }),
    ).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox"), "กสิกร");
    expect(
      screen.getByRole("button", { name: /ธนาคารกสิกรไทย/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /ธนาคารกรุงเทพ/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ธนาคารกสิกรไทย/ }));
    expect(onChange).toHaveBeenCalledWith({
      bankCode: "kbank",
      accountNumber: "",
      accountName: "",
      legacy: "",
    });
  });

  it("shows the selected bank and edits structured account fields", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function StatefulFields() {
      const [value, setValue] = useState<BankDetails>({
          bankCode: "scb",
          accountNumber: "",
          accountName: "",
          legacy: "",
      });
      return (
        <BankAccountFields
          value={value}
          onChange={(nextValue) => {
            setValue(nextValue);
            onChange(nextValue);
          }}
        />
      );
    }
    render(<StatefulFields />);

    expect(screen.getByText("ธนาคารไทยพาณิชย์")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "SCB" })).toHaveAttribute(
      "src",
      "/banks/scb.png",
    );

    await user.type(screen.getByRole("textbox", { name: "เลขบัญชี" }), "123-456");
    expect(onChange).toHaveBeenLastCalledWith({
      bankCode: "scb",
      accountNumber: "123456",
      accountName: "",
      legacy: "",
    });

    await user.type(screen.getByRole("textbox", { name: "ชื่อบัญชี" }), "สมชาย");
    expect(onChange).toHaveBeenCalled();
  });

  it("keeps legacy details visible until a bank is selected", () => {
    render(
      <BankAccountFields
        value={{
          bankCode: "",
          accountNumber: "",
          accountName: "",
          legacy: "ธนาคารเดิม · 1234 · สมชาย",
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("ข้อมูลบัญชีเดิม")).toBeInTheDocument();
    expect(screen.getByText("ธนาคารเดิม · 1234 · สมชาย")).toBeInTheDocument();
  });
});
