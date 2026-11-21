"use client";

import { useEffect, useState } from "react";
import Youtube from "@tiptap/extension-youtube";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { normalizeLinkUrl, normalizeYoutubeUrl } from "./rich-text-urls";
import { PlayIcon } from "@/components/icons";

type Props = {
  value: string;
  onChange: (html: string) => void;
  maxCharacters?: number;
  allowVideo?: boolean;
  label?: string;
  disabled?: boolean;
};

export function RichTextEditor({
  value,
  onChange,
  maxCharacters = 5000,
  allowVideo = true,
  label = "รายละเอียดสินค้า",
  disabled = false,
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
    editable: !disabled,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Youtube.configure({ controls: true, nocookie: true }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "rich-editor-content min-h-64 px-4 py-4 text-sm leading-7 text-ink outline-none sm:min-h-72",
        "aria-label": label,
      },
    },
    onUpdate({ editor: currentEditor }) {
      if (disabled) return;
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
          }
        : null,
  });

  useEffect(() => {
    // Native fieldset disabling does not apply to ProseMirror's contenteditable.
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);

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

  function submitLink() {
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

  function openVideoPopover() {
    const { from, to } = activeEditor.state.selection;
    setSavedSelection({ from, to });
    setUrlValue("");
    setUrlError(null);
    setPopover("video");
  }

  function submitVideo() {
    const src = normalizeYoutubeUrl(urlValue);
    if (!src || !savedSelection) {
      setUrlError("รองรับเฉพาะลิงก์ YouTube");
      return;
    }

    activeEditor
      .chain()
      .focus()
      .setTextSelection(savedSelection)
      .setYoutubeVideo({ src })
      .run();
    closePopover();
  }

  return (
    <>
      <fieldset disabled={disabled} className="rich-editor min-w-0">
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
          {allowVideo && <button
            type="button"
            aria-label="เพิ่มวิดีโอ"
            aria-pressed={popover === "video"}
            onClick={openVideoPopover}
            className={`editor-button ${popover === "video" ? "bg-paper-dim text-ink" : ""}`}
          >
            <PlayIcon className="size-3.5" />
          </button>}
        </div>
        {popover === "link" && (
          <div
            role="dialog"
            aria-label="เพิ่มลิงก์"
            onKeyDown={(event) => {
              if (event.key === "Escape") closePopover();
              if (event.key === "Enter") {
                event.preventDefault();
                submitLink();
              }
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
                  type="button"
                  onClick={submitLink}
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
          </div>
        )}
        {popover === "video" && (
          <div
            role="dialog"
            aria-label="เพิ่มวิดีโอ YouTube"
            onKeyDown={(event) => {
              if (event.key === "Escape") closePopover();
              if (event.key === "Enter") {
                event.preventDefault();
                submitVideo();
              }
            }}
            className="border-b border-line bg-paper-dim p-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 text-xs font-medium text-ink-soft">
                URL YouTube
                <input
                  autoFocus
                  value={urlValue}
                  onChange={(event) => {
                    setUrlValue(event.target.value);
                    if (urlError) setUrlError(null);
                  }}
                  aria-invalid={Boolean(urlError)}
                  aria-describedby={urlError ? "rich-video-error" : undefined}
                  placeholder="https://youtube.com/watch?v=..."
                  className="mt-1 block w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={submitVideo}
                  className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-paper"
                >
                  บันทึกวิดีโอ
                </button>
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
                id="rich-video-error"
                role="alert"
                className="mt-2 text-xs text-red-600"
              >
                {urlError}
              </p>
            )}
          </div>
        )}
        <EditorContent editor={activeEditor} />
      </fieldset>
      {/*
        Read at render time rather than from the editor-state snapshot: the
        snapshot is first taken while the document is still empty, so content
        handed in at mount — a description the agent drafted from a PDF — would
        sit in the editor under a count of zero until the seller typed.
      */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span>เคล็ดลับ: ใช้ heading + bullet list ทำให้อ่านง่ายขึ้น</span>
        <span>
          {activeEditor.getText().length.toLocaleString("th-TH")} /{" "}
          {maxCharacters.toLocaleString("th-TH")} ตัวอักษร
        </span>
      </div>
    </>
  );
}
