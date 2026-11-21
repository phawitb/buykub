import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShopImageUploader } from "./ShopImageUploader";

describe("ShopImageUploader", () => {
  it("shows a newly selected default cover after an upload has finished", async () => {
    const upload = vi.fn().mockResolvedValue({ path: "user/cover.png", publicUrl: "https://cdn/cover.png" });
    const onUploaded = vi.fn();
    const props = { kind: "cover" as const, userId: "user-1", onUploaded, upload };
    const { container, rerender } = render(<ShopImageUploader {...props} value={null} />);
    fireEvent.change(screen.getByLabelText("เลือกรูปปก"), {
      target: { files: [new File(["cover"], "cover.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(onUploaded).toHaveBeenCalled());
    rerender(<ShopImageUploader {...props} value="https://cdn/cover.png" />);
    rerender(<ShopImageUploader {...props} value="/images/shop-covers/nature-01.webp" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "/images/shop-covers/nature-01.webp");
  });

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

  describe("cropping an image that does not fit the frame", () => {
    const sized = (width: number, height: number) => vi.fn(async () => ({ width, height }));
    const box = { width: 320, height: 100 };
    const originals = {
      width: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth"),
      height: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight"),
    };
    beforeEach(() => {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => box.width });
      Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => box.height });
      URL.createObjectURL = vi.fn(() => "blob:source");
      URL.revokeObjectURL = vi.fn();
    });
    afterEach(() => {
      if (originals.width) Object.defineProperty(HTMLElement.prototype, "clientWidth", originals.width);
      if (originals.height) Object.defineProperty(HTMLElement.prototype, "clientHeight", originals.height);
    });

    it("asks which part of a 4:3 cover to show, then uploads only that part at 1600 × 500", async () => {
      const upload = vi.fn().mockResolvedValue({ path: "user/cover.jpg", publicUrl: "https://cdn/cover.jpg" });
      const cropped = new File(["c"], "photo.jpg", { type: "image/jpeg" });
      const renderCrop = vi.fn(async () => cropped);
      render(<ShopImageUploader kind="cover" userId="user-1" value={null} onUploaded={vi.fn()} upload={upload} readSize={sized(1200, 900)} renderCrop={renderCrop} />);
      fireEvent.change(screen.getByLabelText("เลือกรูปปก"), { target: { files: [new File(["p"], "photo.png", { type: "image/png" })] } });

      expect(await screen.findByLabelText("กรอบเลือกส่วนของรูป")).toBeInTheDocument();
      expect(upload).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole("button", { name: "ใช้ส่วนนี้" }));

      await waitFor(() => expect(upload).toHaveBeenCalledWith(expect.objectContaining({ file: cropped })));
      // Centred: the full width, and the middle band of the height.
      const [, region, width, height] = renderCrop.mock.calls[0] as unknown as [File, { sx: number; sy: number; sw: number; sh: number }, number, number];
      expect([width, height]).toEqual([1600, 500]);
      expect(region.sx).toBeCloseTo(0);
      expect(region.sw).toBeCloseTo(1200);
      expect(region.sh).toBeCloseTo(375);
      expect(region.sy).toBeCloseTo((900 - 375) / 2);
    });

    it("uploads an image that already fits without asking", async () => {
      const upload = vi.fn().mockResolvedValue({ path: "user/cover.png", publicUrl: "https://cdn/cover.png" });
      render(<ShopImageUploader kind="cover" userId="user-1" value={null} onUploaded={vi.fn()} upload={upload} readSize={sized(1600, 500)} />);
      fireEvent.change(screen.getByLabelText("เลือกรูปปก"), { target: { files: [new File(["p"], "cover.png", { type: "image/png" })] } });
      await waitFor(() => expect(upload).toHaveBeenCalled());
      expect(screen.queryByLabelText("กรอบเลือกส่วนของรูป")).toBeNull();
    });

    it("can be cancelled without uploading", async () => {
      const upload = vi.fn();
      render(<ShopImageUploader kind="avatar" userId="user-1" value={null} onUploaded={vi.fn()} upload={upload} readSize={sized(800, 600)} />);
      fireEvent.change(screen.getByLabelText("เลือกรูปโปรไฟล์"), { target: { files: [new File(["p"], "me.png", { type: "image/png" })] } });
      await userEvent.click(await screen.findByRole("button", { name: "ยกเลิก" }));
      expect(screen.queryByLabelText("กรอบเลือกส่วนของรูป")).toBeNull();
      expect(upload).not.toHaveBeenCalled();
    });
  });
});
