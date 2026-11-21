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

function placeCursorAtEnd(editor: HTMLElement) {
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

async function renderEditor(value = "<p>ข้อความทดสอบ</p>") {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(
    <RichTextEditor
      value={value}
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

describe("RichTextEditor link popover", () => {
  it("links selected text and normalizes a bare domain", async () => {
    const { onChange, user } = await renderEditor();

    await user.click(screen.getByRole("button", { name: "เพิ่มลิงก์" }));
    await user.type(screen.getByLabelText("URL ลิงก์"), "example.com");
    await user.click(screen.getByRole("button", { name: "บันทึกลิงก์" }));

    expect(onChange.mock.lastCall?.[0]).toContain(
      'href="https://example.com/"',
    );
    expect(onChange.mock.lastCall?.[0]).toContain(
      ">ข้อความทดสอบ</a>",
    );
  });

  it("inserts linked URL text when there is no selection", async () => {
    const { editor, onChange, user } = await renderEditor();
    placeCursorAtEnd(editor);

    await user.click(screen.getByRole("button", { name: "เพิ่มลิงก์" }));
    await user.type(screen.getByLabelText("URL ลิงก์"), "https://framelink.app");
    await user.click(screen.getByRole("button", { name: "บันทึกลิงก์" }));

    expect(onChange.mock.lastCall?.[0]).toContain(
      '<a target="_blank" rel="noopener noreferrer nofollow" href="https://framelink.app/">https://framelink.app/</a>',
    );
  });

  it("keeps the popover open and content unchanged for an invalid URL", async () => {
    const { onChange, user } = await renderEditor();
    const htmlBeforeOpen = onChange.mock.lastCall?.[0];

    await user.click(screen.getByRole("button", { name: "เพิ่มลิงก์" }));
    await user.type(screen.getByLabelText("URL ลิงก์"), "javascript:alert(1)");
    await user.click(screen.getByRole("button", { name: "บันทึกลิงก์" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "กรอก URL ที่ขึ้นต้นด้วย http:// หรือ https://",
    );
    expect(screen.getByLabelText("URL ลิงก์")).toBeInTheDocument();
    expect(onChange.mock.lastCall?.[0]).toBe(htmlBeforeOpen);
  });

  it("closes without changing content when canceled", async () => {
    const { onChange, user } = await renderEditor();
    const htmlBeforeOpen = onChange.mock.lastCall?.[0];

    await user.click(screen.getByRole("button", { name: "เพิ่มลิงก์" }));
    await user.type(screen.getByLabelText("URL ลิงก์"), "example.com");
    await user.click(screen.getByRole("button", { name: "ยกเลิก" }));

    expect(screen.queryByLabelText("URL ลิงก์")).not.toBeInTheDocument();
    expect(onChange.mock.lastCall?.[0]).toBe(htmlBeforeOpen);
  });

  it("prefills and removes an existing link", async () => {
    const { onChange, user } = await renderEditor(
      '<p><a href="https://old.example/">ข้อความทดสอบ</a></p>',
    );

    await user.click(screen.getByRole("button", { name: "เพิ่มลิงก์" }));
    expect(screen.getByLabelText("URL ลิงก์")).toHaveValue(
      "https://old.example/",
    );
    await user.click(screen.getByRole("button", { name: "ลบลิงก์" }));

    expect(onChange.mock.lastCall?.[0]).toBe("<p>ข้อความทดสอบ</p>");
    expect(screen.queryByLabelText("URL ลิงก์")).not.toBeInTheDocument();
  });

  it("closes the popover with Escape without changing content", async () => {
    const { onChange, user } = await renderEditor();
    const htmlBeforeOpen = onChange.mock.lastCall?.[0];

    await user.click(screen.getByRole("button", { name: "เพิ่มลิงก์" }));
    await user.type(screen.getByLabelText("URL ลิงก์"), "example.com");
    await user.keyboard("{Escape}");

    expect(screen.queryByLabelText("URL ลิงก์")).not.toBeInTheDocument();
    expect(onChange.mock.lastCall?.[0]).toBe(htmlBeforeOpen);
  });
});

describe("RichTextEditor YouTube popover", () => {
  it("inserts a YouTube embed from a watch URL", async () => {
    const { onChange, user } = await renderEditor();

    await user.click(screen.getByRole("button", { name: "เพิ่มวิดีโอ" }));
    await user.type(
      screen.getByLabelText("URL YouTube"),
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    await user.click(screen.getByRole("button", { name: "บันทึกวิดีโอ" }));

    expect(onChange.mock.lastCall?.[0]).toContain(
      'src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"',
    );
  });

  it("rejects a non-YouTube URL without changing content", async () => {
    const { onChange, user } = await renderEditor();
    const htmlBeforeOpen = onChange.mock.lastCall?.[0];

    await user.click(screen.getByRole("button", { name: "เพิ่มวิดีโอ" }));
    await user.type(
      screen.getByLabelText("URL YouTube"),
      "https://example.com/video",
    );
    await user.click(screen.getByRole("button", { name: "บันทึกวิดีโอ" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "รองรับเฉพาะลิงก์ YouTube",
    );
    expect(screen.getByLabelText("URL YouTube")).toBeInTheDocument();
    expect(onChange.mock.lastCall?.[0]).toBe(htmlBeforeOpen);
  });

  it("cancels a video insertion with Escape", async () => {
    const { onChange, user } = await renderEditor();
    const htmlBeforeOpen = onChange.mock.lastCall?.[0];

    await user.click(screen.getByRole("button", { name: "เพิ่มวิดีโอ" }));
    await user.type(
      screen.getByLabelText("URL YouTube"),
      "https://youtu.be/dQw4w9WgXcQ",
    );
    await user.keyboard("{Escape}");

    expect(screen.queryByLabelText("URL YouTube")).not.toBeInTheDocument();
    expect(onChange.mock.lastCall?.[0]).toBe(htmlBeforeOpen);
  });
});

describe("RichTextEditor character count", () => {
  it("counts the text it was handed, before the seller types anything", async () => {
    // The agent fills the description from the PDF, so the editor's first
    // content arrives at mount. A count of zero under a full description
    // reads as a field that failed to fill.
    render(<RichTextEditor value="<p>คู่มือสูตรขนมปัง</p>" onChange={vi.fn()} />);
    await screen.findByLabelText("รายละเอียดสินค้า");
    expect(await screen.findByText("16 / 5,000 ตัวอักษร")).toBeInTheDocument();
  });
});
