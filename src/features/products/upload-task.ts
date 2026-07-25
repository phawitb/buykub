import type { UploadResult } from "@/lib/supabase/upload";

export type UploadStatus =
  | "queued"
  | "uploading"
  | "success"
  | "error"
  | "canceled";

export type UploadTask = {
  id: string;
  file: File;
  status: UploadStatus;
  percent: number;
  sentBytes: number;
  totalBytes: number;
  result: UploadResult | null;
  error: string | null;
};

export type UploadTaskAction =
  | { type: "START" }
  | {
      type: "PROGRESS";
      percent: number;
      sentBytes: number;
      totalBytes: number;
    }
  | { type: "SUCCESS"; result: UploadResult }
  | { type: "FAIL"; message: string }
  | { type: "CANCEL" }
  | { type: "RETRY" };

export function createUploadTask(file: File): UploadTask {
  return {
    id: crypto.randomUUID(),
    file,
    status: "queued",
    percent: 0,
    sentBytes: 0,
    totalBytes: file.size,
    result: null,
    error: null,
  };
}

export function uploadTaskReducer(
  task: UploadTask,
  action: UploadTaskAction,
): UploadTask {
  switch (action.type) {
    case "START":
      return {
        ...task,
        status: "uploading",
        percent: 0,
        sentBytes: 0,
        error: null,
      };
    case "PROGRESS":
      return {
        ...task,
        percent: Math.max(0, Math.min(100, action.percent)),
        sentBytes: action.sentBytes,
        totalBytes: action.totalBytes,
      };
    case "SUCCESS":
      return {
        ...task,
        status: "success",
        percent: 100,
        sentBytes: task.totalBytes,
        result: action.result,
        error: null,
      };
    case "FAIL":
      return {
        ...task,
        status: "error",
        error: action.message,
      };
    case "CANCEL":
      return {
        ...task,
        status: "canceled",
        error: null,
      };
    case "RETRY":
      return {
        ...task,
        status: "queued",
        percent: 0,
        sentBytes: 0,
        result: null,
        error: null,
      };
  }
}
