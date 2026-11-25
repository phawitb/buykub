import { describe, expect, it } from "vitest";
import { examPackPath, readExamSummary, summarizeExamPack, validateExamPack, type ExamPack } from "../pack";

const question = (id: string) => [id, "หัวข้อ", "โจทย์", ["ก", "ข", "ค", "ง"], 0, "เฉลย", id];
const subject = (key: string, code: string, practice: number, perSet: number) => ({
  key, code, name: `วิชา ${code}`, short: code, total: practice + perSet * 2, practice, perSet, chapters: [{}, {}],
});
function pack(): ExamPack {
  return {
    format: "exam-prep", version: 1, id: "demo", meta: { title: "คอร์สทดลอง" },
    subjects: [subject("math", "M", 4, 2), subject("law", "L", 2, 3)],
    questions: {
      math: Array.from({ length: 8 }, (_, i) => question(`M${i}`)),
      law: Array.from({ length: 8 }, (_, i) => question(`L${i}`)),
    },
    plan: [{ day: 1, kind: "study" }, { day: 2, kind: "mock" }],
    mock: { count: 2, minutes: 60 },
    scoring: { parts: [{ name: "ภาคทั่วไป", subjects: ["M"], pass: 0.6 }, { name: "ภาคเฉพาะ", subjects: ["L"], pass: 0.5 }] },
  } as ExamPack;
}

describe("exam packs", () => {
  it("accepts a consistent pack", () => {
    expect(validateExamPack(pack())).toEqual([]);
  });
  it("rejects files that are not packs", () => {
    expect(validateExamPack({ lessons: [] })).toHaveLength(1);
    expect(validateExamPack(null)).toHaveLength(1);
  });
  it("names each structural problem", () => {
    const broken = pack();
    broken.version = 2;
    broken.questions.math.pop();
    broken.plan[1].day = 5;
    const errors = validateExamPack(broken);
    expect(errors.some(e => e.includes("เวอร์ชัน"))).toBe(true);
    expect(errors.some(e => e.includes("วิชา M"))).toBe(true);
    expect(errors.some(e => e.includes("แผนรายวัน"))).toBe(true);
  });
  it("lets a drill pack go without a plan, and only a drill pack", () => {
    const drill = { ...pack(), mode: "drill" as const, plan: [] };
    expect(validateExamPack(drill)).toEqual([]);
    expect(summarizeExamPack(drill)).toMatchObject({ mode: "drill", days: 0, mocks: 2 });
    expect(validateExamPack({ ...pack(), plan: [] }).some(e => e.includes("แผนรายวัน"))).toBe(true);
    expect(validateExamPack({ ...pack(), mode: "quiz" }).some(e => e.includes("โหมด"))).toBe(true);
  });
  it("rejects a practice/mock split that does not add up", () => {
    const broken = pack();
    broken.subjects[0].practice = 3;
    expect(validateExamPack(broken).some(e => e.includes("ไม่ลงตัว"))).toBe(true);
  });
  it("summarizes counts only", () => {
    const summary = summarizeExamPack(pack());
    expect(summary).toMatchObject({ id: "demo", days: 2, questions: 16, practice: 6, mocks: 2, mockQuestions: 5, mockMinutes: 60, chapters: 4 });
    expect(summary.parts).toEqual([{ name: "ภาคทั่วไป", pass: 0.6, max: 2 }, { name: "ภาคเฉพาะ", pass: 0.5, max: 3 }]);
    expect(JSON.stringify(summary)).not.toContain("โจทย์");
    expect(readExamSummary(summary)).toEqual(summary);
  });
  it("treats anything else on the product row as no summary", () => {
    expect(readExamSummary(null)).toBeNull();
    expect(readExamSummary({ format: "exam-prep", days: "7" })).toBeNull();
  });
  it("keeps every pack under its seller's storage prefix", () => {
    expect(examPackPath("owner", "product")).toBe("owner/exam-prep/product/pack.json");
  });
});
