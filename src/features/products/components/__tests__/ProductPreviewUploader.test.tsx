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
  const uploadAsset = vi.fn(async () => {
    uploads += 1;
    return { path: `user-1/${uploads}.png`, publicUrl: `https://cdn.example/${uploads}.png` };
  });
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
      />
    );
  }
  render(<Harness />);
  return { renderPreview, uploadAsset, deleteAsset, changes };
}

it("marks each new sample with the shop's watermark before it is uploaded", async () => {
  const { renderPreview, uploadAsset, changes } = setup();
  await userEvent.upload(screen.getByLabelText("เลือกรูปตัวอย่าง"), [
    new File(["a"], "a.jpg", { type: "image/jpeg" }),
    new File(["b"], "b.png", { type: "image/png" }),
  ]);
  await waitFor(() => expect(changes.at(-1)).toHaveLength(2));
  expect(renderPreview).toHaveBeenCalledWith(expect.any(File), { blur: false, watermark: true }, expect.objectContaining({ watermarkText: "ร้านชีสส์" }));
  // Only the redrawn image is uploaded, never the original.
  expect(uploadAsset.mock.calls.map((call) => ((call as unknown[])[0] as { file: File }).file.name)).toEqual(["preview-w.png", "preview-w.png"]);
  expect(changes.at(-1)![0]).toMatchObject({ publicUrl: "https://cdn.example/1.png", width: 800, height: 1200, blur: false, watermark: true });
});

it("re-protects one sample from its clean original and drops the replaced file", async () => {
  const { renderPreview, deleteAsset, changes } = setup();
  await userEvent.upload(screen.getByLabelText("เลือกรูปตัวอย่าง"), new File(["a"], "a.jpg", { type: "image/jpeg" }));
  await waitFor(() => expect(changes.at(-1)).toHaveLength(1));
  const original = renderPreview.mock.calls[0][0];

  await userEvent.click(screen.getByRole("button", { name: "เบลอรูปตัวอย่าง 1" }));
  await waitFor(() => expect(changes.at(-1)![0]).toMatchObject({ blur: true, watermark: true, path: "user-1/2.png" }));
  expect(renderPreview.mock.calls[1][0]).toBe(original);
  expect(deleteAsset).toHaveBeenCalledWith("product-image", "user-1/1.png");
  expect(screen.getByRole("button", { name: "เบลอรูปตัวอย่าง 1" })).toHaveAttribute("aria-pressed", "true");
});

it("refuses files that are not images, and keeps saved samples' settings fixed", async () => {
  const saved = { id: "s", path: "user-1/s.png", publicUrl: "https://cdn.example/s.png", width: 10, height: 10, blur: true, watermark: false };
  const { uploadAsset } = setup([saved]);
  await userEvent.upload(screen.getByLabelText("เลือกรูปตัวอย่าง"), new File(["%PDF"], "doc.pdf", { type: "application/pdf" }), { applyAccept: false });
  expect(screen.getByRole("alert")).toHaveTextContent("รองรับเฉพาะ JPG, PNG และ WebP");
  expect(uploadAsset).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "เบลอรูปตัวอย่าง 1" })).toBeDisabled();
});
