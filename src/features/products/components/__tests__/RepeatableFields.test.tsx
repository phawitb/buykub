import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  FAQFields,
  HighlightFields,
} from "@/features/products/components/RepeatableFields";

describe("RepeatableFields ordering", () => {
  it("moves highlights without changing their text", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <HighlightFields
        value={["ไฟล์ PDF", "Audio book"]}
        onChange={onChange}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "เลื่อนจุดเด่น 2 ขึ้น" }),
    );
    expect(onChange).toHaveBeenCalledWith(["Audio book", "ไฟล์ PDF"]);
  });

  it("moves complete FAQ entries as one unit", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FAQFields
        value={[
          { id: "one", question: "คำถามแรก", answer: "คำตอบแรก" },
          { id: "two", question: "คำถามสอง", answer: "คำตอบสอง" },
        ]}
        onChange={onChange}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "เลื่อนคำถาม 2 ขึ้น" }),
    );
    expect(onChange).toHaveBeenCalledWith([
      { id: "two", question: "คำถามสอง", answer: "คำตอบสอง" },
      { id: "one", question: "คำถามแรก", answer: "คำตอบแรก" },
    ]);
  });
});
