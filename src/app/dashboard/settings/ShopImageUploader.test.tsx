import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ShopImageUploader } from "./ShopImageUploader";

describe("ShopImageUploader", () => {
  it("shows the full PIXZA image guidance for profile and cover images", () => {
    const { rerender } = render(
      <ShopImageUploader
        kind="avatar"
        userId="user-1"
        value={null}
        onUploaded={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/JPG, PNG, WebP · สูงสุด 2 MB/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/ใช้รูปใบหน้าหรือโลโก้ พื้นหลังเรียบ/),
    ).toBeInTheDocument();

    rerender(
      <ShopImageUploader
        kind="cover"
        userId="user-1"
        value={null}
        onUploaded={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        /หลีกเลี่ยงข้อความสำคัญที่ขอบซ้าย — รูปโปรไฟล์จะทับ/,
      ),
    ).toBeInTheDocument();
  });

  it("shows byte progress while uploading a shop image", async () => {
    const upload = vi.fn(({ onProgress }) => {
      onProgress(42, 420, 1000);
      return new Promise<{ path: string; publicUrl: string | null }>(() => {});
    });

    render(
      <ShopImageUploader
        kind="avatar"
        userId="user-1"
        value={null}
        onUploaded={vi.fn()}
        upload={upload}
      />,
    );
    fireEvent.change(screen.getByLabelText("เลือกรูปโปรไฟล์"), {
      target: {
        files: [new File(["avatar"], "avatar.png", { type: "image/png" })],
      },
    });

    expect(await screen.findByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "42",
    );
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("keeps the upload active when the local preview is created", async () => {
    const upload = vi.fn(({ onProgress, signal }) => {
      return new Promise<{ path: string; publicUrl: string | null }>(
        (resolve, reject) => {
          signal.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
          window.setTimeout(() => onProgress(35, 350, 1000), 0);
        },
      );
    });

    render(
      <ShopImageUploader
        kind="avatar"
        userId="user-1"
        value={null}
        onUploaded={vi.fn()}
        upload={upload}
      />,
    );
    fireEvent.change(screen.getByLabelText("เลือกรูปโปรไฟล์"), {
      target: {
        files: [new File(["avatar"], "avatar.png", { type: "image/png" })],
      },
    });

    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "35",
      );
    });
    expect(screen.queryByText("ยกเลิกการอัปโหลดแล้ว")).not.toBeInTheDocument();
  });

  it("can retry a failed upload without selecting the file again", async () => {
    const user = userEvent.setup();
    const upload = vi
      .fn()
      .mockRejectedValueOnce(new Error("เครือข่ายขัดข้อง"))
      .mockResolvedValueOnce({
        path: "user/cover.png",
        publicUrl: "https://cdn/cover.png",
      });

    render(
      <ShopImageUploader
        kind="cover"
        userId="user-1"
        value={null}
        onUploaded={vi.fn()}
        upload={upload}
      />,
    );
    fireEvent.change(screen.getByLabelText("เลือกรูปปก"), {
      target: {
        files: [new File(["cover"], "cover.png", { type: "image/png" })],
      },
    });

    expect(await screen.findByText("เครือข่ายขัดข้อง")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ลองใหม่" }));

    expect(upload).toHaveBeenCalledTimes(2);
  });
});
