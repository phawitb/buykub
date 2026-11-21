import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { ProductPreviewUploader, type RenderPreview } from "@/features/products/components/ProductPreviewUploader";
import type { ProductPreviewImage } from "@/features/products/model";

const options = { blurStrength: 0, watermarkOpacity: 30, watermarkText: "ร้านชีสส์" };

function setup(initial: ProductPreviewImage[] = []) {
  let uploads = 0;
  const renderPreview = vi.fn<RenderPreview>(async (source, protection) => ({
    file: new File([source.name], `preview-${protection.blur ? "b" : ""}${protection.watermark ? "w" : ""}.png`, { type: "image/png" }),
    width: 800,
    height: 1200,
  }));
  const uploadAsset = vi.fn(async (request: { destination: string }) => {
    uploads += 1;
    return request.destination === "product-file"
      ? { path: `user-1/source-${uploads}.png`, publicUrl: null }
      : { path: `user-1/${uploads}.png`, publicUrl: `https://cdn.example/${uploads}.png` };
  });
  const downloadSource = vi.fn(async () => new Blob(["clean"], { type: "image/jpeg" }));
  const deleteAsset = vi.fn(async () => undefined);
  const changes: ProductPreviewImage[][] = [];
  function Harness() {
    const [value, setValue] = useState(initial);
    return (
      <ProductPreviewUploader
        userId="user-1"
        value={value}
        onChange={(next) => { changes.push(next); setValue(next); }}
        protectionOptions={options}
        renderPreview={renderPreview}
        uploadAsset={uploadAsset}
        deleteAsset={deleteAsset}
        downloadSource={downloadSource}
      />
    );
  }
  render(<Harness />);
  return { renderPreview, uploadAsset, deleteAsset, downloadSource, changes };
}

it("marks each new sample with the shop's watermark before it is uploaded", async () => {
  const { renderPreview, uploadAsset, changes } = setup();
  await userEvent.upload(screen.getByLabelText("เลือกรูปตัวอย่าง"), [
    new File(["a"], "a.jpg", { type: "image/jpeg" }),
    new File(["b"], "b.png", { type: "image/png" }),
  ]);
  await waitFor(() => expect(changes.at(-1)).toHaveLength(2));
  expect(renderPreview).toHaveBeenCalledWith(expect.any(File), { blur: false, watermark: true }, expect.objectContaining({ watermarkText: "ร้านชีสส์" }));
  // Only the marked image is public; the clean redraw goes to the private bucket.
  const sent = uploadAsset.mock.calls.map((call) => (call as unknown[])[0] as { file: File; destination: string });
  expect(sent.filter((call) => call.destination === "product-image").map((call) => call.file.name)).toEqual(["preview-w.png", "preview-w.png"]);
  expect(sent.filter((call) => call.destination === "product-file").map((call) => call.file.name)).toEqual(["preview-.png", "preview-.png"]);
  expect(changes.at(-1)![0]).toMatchObject({ width: 800, height: 1200, blur: false, watermark: true, sourcePath: expect.stringMatching(/^user-1\/source-/) });
  expect(changes.at(-1)![0].publicUrl).toMatch(/^https:\/\/cdn\.example\//);
});

it("re-protects one sample from its clean original and drops the replaced file", async () => {
  const { renderPreview, deleteAsset, changes } = setup();
  await userEvent.upload(screen.getByLabelText("เลือกรูปตัวอย่าง"), new File(["a"], "a.jpg", { type: "image/jpeg" }));
  await waitFor(() => expect(changes.at(-1)).toHaveLength(1));
  const original = renderPreview.mock.calls[0][0];

  const before = changes.at(-1)![0];
  await userEvent.click(screen.getByRole("button", { name: "เบลอรูปตัวอย่าง 1" }));
  await waitFor(() => expect(changes.at(-1)![0]).toMatchObject({ blur: true, watermark: true, sourcePath: before.sourcePath }));
  expect(changes.at(-1)![0].path).not.toBe(before.path);
  expect(renderPreview.mock.calls.at(-1)![0]).toBe(original);
  expect(deleteAsset).toHaveBeenCalledWith("product-image", before.path);
  expect(screen.getByRole("button", { name: "เบลอรูปตัวอย่าง 1" })).toHaveAttribute("aria-pressed", "true");
});

it("re-protects a saved sample from its private original", async () => {
  const saved = { id: "s", path: "user-1/s.png", publicUrl: "https://cdn.example/s.png", width: 10, height: 10, blur: false, watermark: true, sourcePath: "user-1/src.jpg" };
  const { renderPreview, downloadSource, changes } = setup([saved]);
  await userEvent.click(screen.getByRole("button", { name: "เบลอรูปตัวอย่าง 1" }));
  await waitFor(() => expect(changes.at(-1)![0]).toMatchObject({ blur: true, watermark: true, sourcePath: "user-1/src.jpg" }));
  expect(downloadSource).toHaveBeenCalledWith("user-1/src.jpg");
  expect(renderPreview).toHaveBeenCalledWith(expect.any(File), { blur: true, watermark: true }, expect.anything());
});

it("swaps two samples with two taps", async () => {
  const sample = (id: string) => ({ id, path: `user-1/${id}.png`, publicUrl: `https://cdn.example/${id}.png`, width: 10, height: 10, blur: false, watermark: true });
  const { changes } = setup([sample("a"), sample("b"), sample("c")]);
  expect(screen.queryByRole("button", { name: /ไปซ้าย|ไปขวา/ })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "เลือกรูปตัวอย่าง 1 เพื่อสลับตำแหน่ง" }));
  expect(screen.getByRole("button", { name: "ยกเลิกเลือกรูปตัวอย่าง 1" })).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(screen.getByRole("button", { name: "สลับกับรูปตัวอย่าง 3" }));
  expect(changes.at(-1)!.map((item) => item.id)).toEqual(["c", "b", "a"]);
  expect(screen.queryByRole("button", { name: /ยกเลิกเลือก/ })).toBeNull();
});

it("refuses files that are not images, and keeps samples without an original fixed", async () => {
  const saved = { id: "s", path: "user-1/s.png", publicUrl: "https://cdn.example/s.png", width: 10, height: 10, blur: true, watermark: false };
  const { uploadAsset } = setup([saved]);
  await userEvent.upload(screen.getByLabelText("เลือกรูปตัวอย่าง"), new File(["%PDF"], "doc.pdf", { type: "application/pdf" }), { applyAccept: false });
  expect(screen.getByRole("alert")).toHaveTextContent("รองรับเฉพาะ JPG, PNG และ WebP");
  expect(uploadAsset).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "เบลอรูปตัวอย่าง 1" })).toBeDisabled();
});
