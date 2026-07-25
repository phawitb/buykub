import { describe, expect, it } from "vitest";
import {
  createUploadTask,
  uploadTaskReducer,
} from "@/features/products/upload-task";

const file = new File(["product"], "product.zip", {
  type: "application/zip",
});

describe("uploadTaskReducer", () => {
  it("starts a queued upload", () => {
    const task = createUploadTask(file);

    expect(uploadTaskReducer(task, { type: "START" })).toMatchObject({
      status: "uploading",
      percent: 0,
      sentBytes: 0,
    });
  });

  it("records transmitted byte progress", () => {
    const task = uploadTaskReducer(createUploadTask(file), { type: "START" });

    expect(
      uploadTaskReducer(task, {
        type: "PROGRESS",
        percent: 42,
        sentBytes: 420,
        totalBytes: 1000,
      }),
    ).toMatchObject({
      status: "uploading",
      percent: 42,
      sentBytes: 420,
      totalBytes: 1000,
    });
  });

  it("clamps invalid progress without losing transmitted bytes", () => {
    const task = uploadTaskReducer(createUploadTask(file), { type: "START" });

    expect(
      uploadTaskReducer(task, {
        type: "PROGRESS",
        percent: 140,
        sentBytes: 1400,
        totalBytes: 1000,
      }),
    ).toMatchObject({
      percent: 100,
      sentBytes: 1400,
    });
  });

  it("stores the uploaded object on success", () => {
    const task = uploadTaskReducer(createUploadTask(file), { type: "START" });
    const result = {
      path: "owner/file.zip",
      publicUrl: null,
    };

    expect(uploadTaskReducer(task, { type: "SUCCESS", result })).toMatchObject({
      status: "success",
      percent: 100,
      result,
      error: null,
    });
  });

  it("preserves the file and exposes an actionable failure", () => {
    const task = uploadTaskReducer(createUploadTask(file), { type: "START" });

    const failed = uploadTaskReducer(task, {
      type: "FAIL",
      message: "เครือข่ายขัดข้อง",
    });

    expect(failed).toMatchObject({
      status: "error",
      file,
      error: "เครือข่ายขัดข้อง",
    });
  });

  it("moves a failed task back to the queue for retry", () => {
    const task = uploadTaskReducer(createUploadTask(file), {
      type: "FAIL",
      message: "เครือข่ายขัดข้อง",
    });

    expect(uploadTaskReducer(task, { type: "RETRY" })).toMatchObject({
      status: "queued",
      percent: 0,
      sentBytes: 0,
      error: null,
    });
  });

  it("marks an active upload as canceled", () => {
    const task = uploadTaskReducer(createUploadTask(file), { type: "START" });

    expect(uploadTaskReducer(task, { type: "CANCEL" })).toMatchObject({
      status: "canceled",
      error: null,
    });
  });
});
