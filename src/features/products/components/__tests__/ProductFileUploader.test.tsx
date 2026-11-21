import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ProductFileUploader } from "@/features/products/components/ProductFileUploader";

const uploadAsset = () =>
  vi.fn(async () => ({ path: "user-123/guide.pdf", publicUrl: "https://cdn.test/guide.pdf" }));

async function attach(file: File) {
  await userEvent.upload(screen.getByLabelText("เลือกไฟล์สินค้า"), file);
}

it("records how many pages an uploaded PDF has", async () => {
  const onChange = vi.fn();
  const readPageCount = vi.fn(async () => 42);
  render(
    <ProductFileUploader
      userId="user-123"
      value={null}
      onChange={onChange}
      uploadAsset={uploadAsset()}
      readPageCount={readPageCount}
    />,
  );

  await attach(new File(["%PDF-1.7"], "guide.pdf", { type: "application/pdf" }));

  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "guide.pdf", pageCount: 42 }),
    ),
  );
  expect(readPageCount).toHaveBeenCalledTimes(1);
});

it("does not go looking for pages in a file that has none", async () => {
  const onChange = vi.fn();
  const readPageCount = vi.fn(async () => 42);
  render(
    <ProductFileUploader
      userId="user-123"
      value={null}
      onChange={onChange}
      uploadAsset={uploadAsset()}
      readPageCount={readPageCount}
    />,
  );

  await attach(new File(["zipped"], "pack.zip", { type: "application/zip" }));

  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ pageCount: null })),
  );
  expect(readPageCount).not.toHaveBeenCalled();
});

it("still accepts a PDF whose pages cannot be counted", async () => {
  const onChange = vi.fn();
  render(
    <ProductFileUploader
      userId="user-123"
      value={null}
      onChange={onChange}
      uploadAsset={uploadAsset()}
      readPageCount={vi.fn(async () => {
        throw new Error("ไฟล์เสียหาย");
      })}
    />,
  );

  await attach(new File(["%PDF-1.7"], "guide.pdf", { type: "application/pdf" }));

  // The count is a nicety; losing it must not cost the seller the upload.
  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ path: "user-123/guide.pdf", pageCount: null }),
    ),
  );
  expect(screen.getByText("อัปโหลดสำเร็จ")).toBeInTheDocument();
});

it("takes only a PDF as a course's companion file", async () => {
  const onChange = vi.fn();
  const upload = uploadAsset();
  render(<ProductFileUploader coursePdf userId="user-123" value={null} onChange={onChange} uploadAsset={upload} readPageCount={async () => 3} />);

  expect(screen.getByRole("heading", { name: "ไฟล์ PDF ประกอบคอร์ส" })).toBeInTheDocument();
  expect(screen.getByLabelText("เลือกไฟล์สินค้า")).toHaveAttribute("accept", ".pdf,application/pdf");
  await userEvent.upload(screen.getByLabelText("เลือกไฟล์สินค้า"), new File(["zip"], "notes.zip", { type: "application/zip" }), { applyAccept: false });
  expect(screen.getByRole("alert")).toHaveTextContent("รองรับเฉพาะไฟล์ PDF");
  expect(upload).not.toHaveBeenCalled();

  await attach(new File(["%PDF-1.7"], "course.pdf", { type: "application/pdf" }));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ fileName: "course.pdf", mimeType: "application/pdf", pageCount: 3 })));
});
