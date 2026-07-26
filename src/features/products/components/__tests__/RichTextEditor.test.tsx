import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "@/features/products/components/RichTextEditor";

function selectEditorContents(editor: HTMLElement) {
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

async function renderEditor() {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(
    <RichTextEditor
      value="<p>ข้อความทดสอบ</p>"
      onChange={onChange}
    />,
  );
  const editor = await screen.findByLabelText("รายละเอียดสินค้า");
  selectEditorContents(editor);
  return { editor, onChange, user };
}

describe("RichTextEditor formatting toolbar", () => {
  it.each([
    ["ตัวหนา", "<strong>ข้อความทดสอบ</strong>"],
    ["ตัวเอียง", "<em>ข้อความทดสอบ</em>"],
    ["ขีดทับ", "<s>ข้อความทดสอบ</s>"],
    ["หัวข้อระดับ 2", "<h2>ข้อความทดสอบ</h2>"],
    ["หัวข้อระดับ 3", "<h3>ข้อความทดสอบ</h3>"],
    ["รายการหัวข้อ", "<ul>"],
    ["รายการลำดับเลข", "<ol>"],
    ["ข้อความอ้างอิง", "<blockquote>"],
  ])("applies %s to the selected description", async (buttonName, html) => {
    const { onChange, user } = await renderEditor();

    await user.click(screen.getByRole("button", { name: buttonName }));

    expect(onChange.mock.lastCall?.[0]).toContain(html);
  });

  it("inserts a horizontal rule at the cursor", async () => {
    const { onChange, user } = await renderEditor();

    await user.click(screen.getByRole("button", { name: "เส้นแบ่ง" }));

    expect(onChange.mock.lastCall?.[0]).toContain("<hr>");
  });

  it("reacts to selection changes when showing pressed formatting controls", async () => {
    const { user } = await renderEditor();
    const boldButton = screen.getByRole("button", { name: "ตัวหนา" });

    await user.click(boldButton);
    fireEvent(document, new Event("selectionchange"));

    expect(boldButton).toHaveAttribute("aria-pressed", "true");
  });
});
