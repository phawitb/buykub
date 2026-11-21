// Exam-prep packs are built outside BUYKUB (one JSON file per course) and run by the static
// engine in public/exam-prep. Only the summary below is public; the pack itself is paid content.

export const EXAM_PACK_VERSION = 1;
export const EXAM_PACK_MAX_BYTES = 20 * 1024 * 1024;

type PackSubject = { key: string; code: string; name: string; short: string; total: number; practice: number; perSet: number; chapters: unknown[] };
type PackPart = { name: string; subjects: string[]; pass: number };
export type ExamPack = {
  format: "exam-prep"; version: number; id: string;
  meta: { title: string } & Record<string, unknown>;
  subjects: PackSubject[];
  questions: Record<string, unknown[][]>;
  plan: { day: number; kind: string }[];
  mock: { count: number; minutes: number };
  scoring?: { parts: PackPart[] } | null;
};

export type ExamSummary = {
  format: "exam-prep"; version: number; id: string; title: string;
  days: number; questions: number; practice: number; mocks: number; mockQuestions: number; mockMinutes: number; chapters: number;
  subjects: { key: string; code: string; name: string; short: string; questions: number; perSet: number; chapters: number }[];
  parts: { name: string; max: number; pass: number }[];
};

/** Where the private pack lives in the product-files bucket. Derived, never stored, so it always sits under the seller's own prefix. */
export function examPackPath(ownerId: string, productId: string) {
  return `${ownerId}/exam-prep/${productId}/pack.json`;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isCount = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;

/** Structural checks the engine relies on. Returns Thai messages for the seller; empty means usable. */
export function validateExamPack(value: unknown): string[] {
  if (!isObject(value) || value.format !== "exam-prep") return ["ไฟล์นี้ไม่ใช่แพ็กคอร์สติวสอบ (pack.json)"];
  const errors: string[] = [];
  if (value.version !== EXAM_PACK_VERSION) errors.push(`รองรับแพ็กเวอร์ชัน ${EXAM_PACK_VERSION} เท่านั้น`);
  if (typeof value.id !== "string" || !value.id) errors.push("แพ็กไม่มีรหัสคอร์ส");
  if (!isObject(value.meta) || typeof value.meta.title !== "string" || !value.meta.title) errors.push("แพ็กไม่มีชื่อคอร์ส");
  const mock = value.mock;
  if (!isObject(mock) || !isCount(mock.count) || !isCount(mock.minutes) || !mock.minutes) errors.push("ข้อมูลข้อสอบจำลองไม่ครบ");
  const subjects = Array.isArray(value.subjects) ? value.subjects : [];
  if (!subjects.length) errors.push("แพ็กไม่มีวิชา");
  const questions = isObject(value.questions) ? value.questions : {};
  for (const subject of subjects) {
    if (!isObject(subject) || typeof subject.key !== "string" || typeof subject.code !== "string" || typeof subject.name !== "string" ||
      !isCount(subject.total) || !isCount(subject.practice) || !isCount(subject.perSet) || !Array.isArray(subject.chapters)) {
      errors.push("ข้อมูลวิชาไม่ครบ");
      continue;
    }
    const list = questions[subject.key];
    if (!Array.isArray(list) || list.length !== subject.total) errors.push(`${subject.name}: จำนวนข้อไม่ตรงกับที่ระบุ`);
    else if (isObject(mock) && (subject.practice as number) + (mock.count as number) * (subject.perSet as number) !== subject.total) errors.push(`${subject.name}: แบ่งข้อฝึกและข้อสอบจำลองไม่ลงตัว`);
  }
  const plan = Array.isArray(value.plan) ? value.plan : [];
  if (!plan.length || plan.some((row, index) => !isObject(row) || row.day !== index + 1 || typeof row.kind !== "string")) errors.push("แผนรายวันไม่ถูกต้อง");
  return errors;
}

/** Public counts for the sales page; mirrors summary.json from build_pack.py. Call only on a validated pack. */
export function summarizeExamPack(pack: ExamPack): ExamSummary {
  const byCode = new Map(pack.subjects.map(subject => [subject.code, subject]));
  return {
    format: "exam-prep", version: pack.version, id: pack.id, title: pack.meta.title,
    days: pack.plan.length,
    questions: pack.subjects.reduce((sum, s) => sum + s.total, 0),
    practice: pack.subjects.reduce((sum, s) => sum + s.practice, 0),
    mocks: pack.mock.count,
    mockQuestions: pack.subjects.reduce((sum, s) => sum + s.perSet, 0),
    mockMinutes: pack.mock.minutes,
    chapters: pack.subjects.reduce((sum, s) => sum + s.chapters.length, 0),
    subjects: pack.subjects.map(s => ({ key: s.key, code: s.code, name: s.name, short: s.short, questions: s.total, perSet: s.perSet, chapters: s.chapters.length })),
    parts: (pack.scoring?.parts ?? []).map(part => ({
      name: part.name, pass: part.pass,
      max: part.subjects.reduce((sum, code) => sum + (byCode.get(code)?.perSet ?? 0), 0),
    })),
  };
}

/** Reads the public summary stored on a product row; anything unexpected is treated as absent. */
export function readExamSummary(value: unknown): ExamSummary | null {
  if (!isObject(value) || value.format !== "exam-prep" || !isCount(value.days) || !isCount(value.questions) || !Array.isArray(value.subjects)) return null;
  return value as ExamSummary;
}
