import type { ProductDeliveryType } from "@/features/products/model";

const palettes = {
  file: { background: "#eafaf9", soft: "#d2f2ef", accent: "#2f8a83", line: "#b3f4ef", label: "ไฟล์ดิจิทัล" },
  course: { background: "#f3edff", soft: "#e4d6ff", accent: "#6b4fd0", line: "#d3bdff", label: "คอร์สเรียน" },
  key: { background: "#ecfaef", soft: "#d6f2dc", accent: "#2f7d45", line: "#b3efbd", label: "คีย์สินค้า" },
};

export function ProductPlaceholder({
  productName,
  deliveryType = "file",
}: {
  productName: string;
  deliveryType?: ProductDeliveryType;
}) {
  const palette = palettes[deliveryType];

  return (
    <svg
      role="img"
      aria-label={`ภาพประกอบ${palette.label}สำหรับ ${productName}`}
      viewBox="0 0 320 320"
      className="h-full w-full"
      fill="none"
    >
      <rect width="320" height="320" fill={palette.background} />
      <circle cx="160" cy="160" r="96" fill={palette.soft} opacity=".52" />
      <circle cx="76" cy="117" r="4" fill={palette.line} />
      <circle cx="245" cy="210" r="3" fill={palette.line} />
      <path d="M238 100v12m-6-6h12M72 207v8m-4-4h8" stroke={palette.line} strokeWidth="2" strokeLinecap="round" />

      {deliveryType === "file" && (
        <>
          <rect x="104" y="91" width="119" height="155" rx="12" transform="rotate(9 104 91)" fill={palette.soft} stroke={palette.line} />
          <path d="M118 77h62l34 34v112a12 12 0 0 1-12 12h-84a12 12 0 0 1-12-12V89a12 12 0 0 1 12-12Z" fill="#ffffff" stroke={palette.line} strokeWidth="1.5" />
          <path d="M180 77v24a10 10 0 0 0 10 10h24" fill={palette.soft} />
          <path d="M180 77v24a10 10 0 0 0 10 10h24" stroke={palette.line} strokeWidth="1.5" />
          <rect x="126" y="126" width="35" height="35" rx="8" fill={palette.soft} />
          <path d="M137 144h13m-6-6v12" stroke={palette.accent} strokeWidth="2" strokeLinecap="round" />
          <path d="M127 181h66m-66 12h66m-66 12h42" stroke={palette.line} strokeWidth="4" strokeLinecap="round" />
          <circle cx="213" cy="219" r="22" fill={palette.accent} />
          <path d="M213 209v16m-6-6 6 6 6-6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}

      {deliveryType === "course" && (
        <>
          <rect x="92" y="93" width="148" height="115" rx="12" transform="rotate(7 92 93)" fill={palette.soft} stroke={palette.line} />
          <rect x="78" y="102" width="164" height="116" rx="12" fill="#ffffff" stroke={palette.line} strokeWidth="1.5" />
          <path d="M78 123h164" stroke={palette.line} />
          <circle cx="91" cy="113" r="2" fill={palette.line} />
          <circle cx="100" cy="113" r="2" fill={palette.line} />
          <circle cx="109" cy="113" r="2" fill={palette.line} />
          <circle cx="160" cy="164" r="27" fill={palette.soft} />
          <path d="m155 152 19 12-19 12v-24Z" fill={palette.accent} />
          <path d="M94 202h132" stroke={palette.soft} strokeWidth="3" strokeLinecap="round" />
          <path d="M94 202h52" stroke={palette.accent} strokeWidth="3" strokeLinecap="round" />
          <rect x="109" y="231" width="102" height="5" rx="2.5" fill={palette.line} />
          <rect x="134" y="242" width="52" height="4" rx="2" fill={palette.soft} />
        </>
      )}

      {deliveryType === "key" && (
        <>
          <rect x="87" y="101" width="159" height="119" rx="13" transform="rotate(7 87 101)" fill={palette.soft} stroke={palette.line} />
          <rect x="77" y="111" width="166" height="109" rx="13" fill="#ffffff" stroke={palette.line} strokeWidth="1.5" />
          <path d="M77 137h166" stroke={palette.line} />
          <path d="M93 124h25" stroke={palette.line} strokeWidth="3" strokeLinecap="round" />
          <circle cx="227" cy="124" r="3" fill={palette.accent} />
          <circle cx="134" cy="173" r="14" stroke={palette.accent} strokeWidth="5" />
          <path d="M148 173h47m-11 0v12m-11-12v9" stroke={palette.accent} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M126 239h68" stroke={palette.line} strokeWidth="4" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
