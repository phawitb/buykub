"use client";

import Link from "next/link";

type RouteErrorStateProps = {
  reset: () => void;
  variant?: "storefront" | "dashboard";
};

export function RouteErrorState({
  reset,
  variant = "storefront",
}: RouteErrorStateProps) {
  const dashboard = variant === "dashboard";

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-[#faf9f7] px-5 py-16">
      <div
        role="alert"
        className="w-full max-w-md rounded-3xl border border-line bg-paper p-8 text-center shadow-sm sm:p-10"
      >
        <div
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fff1f1] text-2xl text-[#c43d3d]"
        >
          !
        </div>
        <h1 className="mt-5 text-xl font-bold text-ink">
          {dashboard
            ? "โหลดข้อมูลหลังร้านไม่สำเร็จ"
            : "เปิดหน้านี้ไม่สำเร็จ"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          ระบบอาจขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง
          หากยังพบปัญหาให้กลับไปหน้าหลักแล้วเริ่มใหม่
        </p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <Link
            href={dashboard ? "/dashboard" : "/"}
            className="secondary-button justify-center"
          >
            {dashboard ? "กลับหน้าหลังร้าน" : "กลับหน้าแรก"}
          </Link>
          <button type="button" onClick={reset} className="primary-button">
            ลองอีกครั้ง
          </button>
        </div>
      </div>
    </main>
  );
}
