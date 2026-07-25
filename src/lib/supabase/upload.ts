import { createClient } from "@/lib/supabase/client";

export type UploadDestination = "product-file" | "product-image";

export type UploadResult = {
  path: string;
  publicUrl: string | null;
};

export type UploadRequest = {
  userId: string;
  file: File;
  destination: UploadDestination;
  signal: AbortSignal;
  onProgress: (
    percent: number,
    sentBytes: number,
    totalBytes: number,
  ) => void;
};

const BUCKETS: Record<UploadDestination, string> = {
  "product-file": "product-files",
  "product-image": "product-images",
};

function objectPath(userId: string, file: File): string {
  const rawExtension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const extension = rawExtension.replace(/[^a-z0-9]/g, "") || "bin";
  return `${userId}/${crypto.randomUUID()}.${extension}`;
}

function encodedObjectPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function uploadErrorMessage(status: number, responseText: string): string {
  if (status === 413) return "ไฟล์มีขนาดใหญ่เกินกว่าที่ระบบรองรับ";
  if (status === 401 || status === 403) {
    return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง";
  }

  try {
    const payload = JSON.parse(responseText) as {
      error?: string;
      message?: string;
    };
    const detail = payload.message ?? payload.error;
    if (detail) return `อัปโหลดไม่สำเร็จ: ${detail}`;
  } catch {
    // The storage API can return plain text for upstream network failures.
  }

  return "อัปโหลดไม่สำเร็จ กรุณาลองอีกครั้ง";
}

async function uploadWithProgress(request: UploadRequest): Promise<UploadResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error("ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase");
  }

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง");
  }

  const bucket = BUCKETS[request.destination];
  const path = objectPath(request.userId, request.file);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();

    xhr.open(
      "POST",
      `${supabaseUrl}/storage/v1/object/${bucket}/${encodedObjectPath(path)}`,
    );
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader(
      "Content-Type",
      request.file.type || "application/octet-stream",
    );
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.onprogress = (event) => {
      const totalBytes = event.lengthComputable
        ? event.total
        : request.file.size;
      const percent =
        totalBytes > 0 ? Math.round((event.loaded / totalBytes) * 100) : 0;
      request.onProgress(percent, event.loaded, totalBytes);
    };
    xhr.onerror = () => {
      request.signal.removeEventListener("abort", abort);
      reject(new Error("เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่"));
    };
    xhr.onabort = () => {
      request.signal.removeEventListener("abort", abort);
      reject(new DOMException("ยกเลิกการอัปโหลดแล้ว", "AbortError"));
    };
    xhr.onload = () => {
      request.signal.removeEventListener("abort", abort);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(uploadErrorMessage(xhr.status, xhr.responseText)));
    };

    if (request.signal.aborted) {
      xhr.abort();
      return;
    }
    request.signal.addEventListener("abort", abort, { once: true });
    xhr.send(request.file);
  });

  const publicUrl =
    request.destination === "product-image"
      ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
      : null;

  return { path, publicUrl };
}

export function uploadShopAsset(request: UploadRequest): Promise<UploadResult>;
/** @deprecated Temporary compatibility for the legacy product editor. */
export function uploadShopAsset(userId: string, file: File): Promise<string>;
export async function uploadShopAsset(
  requestOrUserId: UploadRequest | string,
  legacyFile?: File,
): Promise<UploadResult | string> {
  if (typeof requestOrUserId === "string") {
    if (!legacyFile) throw new Error("ไม่พบไฟล์ที่ต้องการอัปโหลด");
    const controller = new AbortController();
    const result = await uploadWithProgress({
      userId: requestOrUserId,
      file: legacyFile,
      destination: "product-image",
      signal: controller.signal,
      onProgress: () => undefined,
    });
    return result.publicUrl!;
  }

  return uploadWithProgress(requestOrUserId);
}

export async function deleteShopAsset(
  destination: UploadDestination,
  path: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKETS[destination]).remove([path]);
  if (error) throw new Error(`ลบไฟล์ไม่สำเร็จ: ${error.message}`);
}
