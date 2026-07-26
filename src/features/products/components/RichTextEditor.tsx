"use client";

import { useState } from "react";
import Youtube from "@tiptap/extension-youtube";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { normalizeLinkUrl } from "./rich-text-urls";

type Props = {
  value: string;
  onChange: (html: string) => void;
  maxCharacters?: number;
};

export function RichTextEditor({
  value,
  onChange,
  maxCharacters = 5000,
}: Props) {
  const [popover, setPopover] = useState<"link" | "video" | null>(null);
  const [urlValue, setUrlValue] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [linkWasActive, setLinkWasActive] = useState(false);
  const [savedSelection, setSavedSelection] = useState<{
    from: number;
    to: number;
  } | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Youtube.configure({ controls: true, nocookie: true }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "min-h-64 px-4 py-4 text-sm leading-7 text-ink outline-none sm:min-h-72",
        "aria-label": "รายละเอียดสินค้า",
      },
    },
    onUpdate({ editor: currentEditor }) {
      if (currentEditor.getText().length > maxCharacters) {
        currentEditor.commands.undo();
        return;
      }
      onChange(currentEditor.getHTML());
    },
  });
  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) =>
      currentEditor
        ? {
            bold: currentEditor.isActive("bold"),
            italic: currentEditor.isActive("italic"),
            strike: currentEditor.isActive("strike"),
            heading2: currentEditor.isActive("heading", { level: 2 }),
            heading3: currentEditor.isActive("heading", { level: 3 }),
            bulletList: currentEditor.isActive("bulletList"),
            orderedList: currentEditor.isActive("orderedList"),
            blockquote: currentEditor.isActive("blockquote"),
            characterCount: currentEditor.getText().length,
          }
        : null,
  });

  if (!editor) return <div className="rich-editor min-h-72 animate-pulse" />;
  const activeEditor = editor;

  const toolbar = [
    {
      label: "ตัวหนา",
      text: "B",
      active: editorState?.bold ?? false,
      action: () => activeEditor.chain().focus().toggleBold().run(),
    },
    {
      label: "ตัวเอียง",
      text: "I",
      active: editorState?.italic ?? false,
      action: () => activeEditor.chain().focus().toggleItalic().run(),
    },
    {
      label: "ขีดทับ",
      text: "S",
      active: editorState?.strike ?? false,
      action: () => activeEditor.chain().focus().toggleStrike().run(),
    },
    {
      label: "หัวข้อระดับ 2",
      text: "H₂",
      active: editorState?.heading2 ?? false,
      action: () =>
        activeEditor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "หัวข้อระดับ 3",
      text: "H₃",
      active: editorState?.heading3 ?? false,
      action: () =>
        activeEditor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: "รายการหัวข้อ",
      text: "☷",
      active: editorState?.bulletList ?? false,
      action: () => activeEditor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "รายการลำดับเลข",
      text: "1.",
      active: editorState?.orderedList ?? false,
      action: () => activeEditor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "ข้อความอ้างอิง",
      text: "❞",
      active: editorState?.blockquote ?? false,
      action: () => activeEditor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: "เส้นแบ่ง",
      text: "—",
      active: false,
      action: () => activeEditor.chain().focus().setHorizontalRule().run(),
    },
  ];

  function openLinkPopover() {
    const previous = activeEditor.getAttributes("link").href as
      | string
      | undefined;
    const { from, to } = activeEditor.state.selection;
    setSavedSelection({ from, to });
    setUrlValue(previous ?? "");
    setLinkWasActive(Boolean(previous));
    setUrlError(null);
    setPopover("link");
  }

  function closePopover() {
    setPopover(null);
    setUrlError(null);
  }

  function submitLink(event: React.FormEvent) {
    event.preventDefault();
    const href = normalizeLinkUrl(urlValue);
    if (!href || !savedSelection) {
      setUrlError("กรอก URL ที่ขึ้นต้นด้วย http:// หรือ https://");
      return;
    }

    const command = activeEditor
      .chain()
      .focus()
      .setTextSelection(savedSelection);
    if (savedSelection.from === savedSelection.to) {
      command
        .insertContent({
          type: "text",
          text: href,
          marks: [{ type: "link", attrs: { href } }],
        })
        .run();
    } else {
      command.setLink({ href }).run();
    }
    closePopover();
  }

  function removeLink() {
    if (!savedSelection) return;
    activeEditor
      .chain()
      .focus()
      .setTextSelection(savedSelection)
      .unsetLink()
      .run();
    closePopover();
  }

  function addVideo() {
    const url = window.prompt("วางลิงก์ YouTube");
    if (url?.trim())
      activeEditor.commands.setYoutubeVideo({ src: url.trim() });
  }

  return (
    <>
      <div className="rich-editor">
        <div className="flex flex-wrap border-b border-line px-2 py-2">
          {toolbar.map((item) => (
            <button
              key={item.label}
              type="button"
              aria-label={item.label}
              aria-pressed={item.active}
              onClick={item.action}
              className={`editor-button ${item.active ? "bg-paper-dim text-ink" : ""}`}
            >
              {item.text}
            </button>
          ))}
          <button
            type="button"
            aria-label="เพิ่มลิงก์"
            aria-pressed={popover === "link"}
            onClick={openLinkPopover}
            className={`editor-button ${popover === "link" ? "bg-paper-dim text-ink" : ""}`}
          >
            🔗
          </button>
          <button
            type="button"
            aria-label="เพิ่มวิดีโอ"
            onClick={addVideo}
            className="editor-button"
          >
            ▷
          </button>
        </div>
        {popover === "link" && (
          <form
            role="dialog"
            aria-label="เพิ่มลิงก์"
            onSubmit={submitLink}
            onKeyDown={(event) => {
              if (event.key === "Escape") closePopover();
            }}
            className="border-b border-line bg-paper-dim p-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 text-xs font-medium text-ink-soft">
                URL ลิงก์
                <input
                  autoFocus
                  value={urlValue}
                  onChange={(event) => {
                    setUrlValue(event.target.value);
                    if (urlError) setUrlError(null);
                  }}
                  aria-invalid={Boolean(urlError)}
                  aria-describedby={urlError ? "rich-link-error" : undefined}
                  placeholder="https://example.com"
                  className="mt-1 block w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-paper"
                >
                  บันทึกลิงก์
                </button>
                {linkWasActive && (
                  <button
                    type="button"
                    onClick={removeLink}
                    className="rounded-lg border border-red-200 bg-paper px-3 py-2 text-xs font-semibold text-red-600"
                  >
                    ลบลิงก์
                  </button>
                )}
                <button
                  type="button"
                  onClick={closePopover}
                  className="rounded-lg border border-line bg-paper px-3 py-2 text-xs font-semibold text-ink"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
            {urlError && (
              <p
                id="rich-link-error"
                role="alert"
                className="mt-2 text-xs text-red-600"
              >
                {urlError}
              </p>
            )}
          </form>
        )}
        <EditorContent editor={activeEditor} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span>เคล็ดลับ: ใช้ heading + bullet list ทำให้อ่านง่ายขึ้น</span>
        <span>
          {(editorState?.characterCount ?? 0).toLocaleString("th-TH")} /{" "}
          {maxCharacters.toLocaleString("th-TH")} ตัวอักษร
        </span>
      </div>
    </>
  );
}
