"use client";

import Youtube from "@tiptap/extension-youtube";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

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

  function setLink() {
    const previous = activeEditor.getAttributes("link").href as
      | string
      | undefined;
    const href = window.prompt("วาง URL", previous ?? "https://");
    if (href === null) return;
    if (!href.trim()) {
      activeEditor.chain().focus().unsetLink().run();
      return;
    }
    activeEditor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href })
      .run();
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
            onClick={setLink}
            className="editor-button"
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
