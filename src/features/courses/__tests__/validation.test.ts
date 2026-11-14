import { describe, expect, it } from "vitest";
import { normalizeDocumentUrl, validateCourseLessons, validAccessDays } from "../validation";
import { sanitizeLessonHtml } from "../sanitize";

describe("course materials", () => {
  it("allows HTTPS documents but rejects credentials and executable or insecure URLs", () => {
    expect(normalizeDocumentUrl("https://docs.google.com/document/d/test")).toContain("docs.google.com");
    for (const url of ["javascript:alert(1)", "data:text/html,test", "http://example.com", "https://user:secret@example.com", "//example.com"]) expect(normalizeDocumentUrl(url)).toBeNull();
  });
  it("removes embedded frames, scripts, handlers and dangerous links while preserving text formatting", () => {
    const html = sanitizeLessonHtml('<h2>Lesson</h2><p><strong>Safe</strong><a href="javascript:alert(1)">link</a></p><iframe src="https://evil.test"></iframe><img src=x onerror=alert(1)><script>alert(1)</script>');
    expect(html).toContain("<strong>Safe</strong>");
    expect(html).not.toMatch(/iframe|script|onerror|javascript|<img/);
  });
  it("accepts lifetime or bounded whole days only", () => {
    for (const days of [null, "", "1", "36500"]) expect(validAccessDays(days)).toBe(true);
    for (const days of ["0", "1.5", "-1", "36501", "abc"]) expect(validAccessDays(days)).toBe(false);
  });
  it("rejects unsafe video and foreign storage documents", () => {
    const errors = validateCourseLessons([{id:"a", title:"Lesson", position:0, content_html:"", youtube_url:"https://evil.test/video", documents:[{id:"doc",name:"file",path:"other/file.pdf"}], published:true}], "owner");
    expect(errors.join(" ")).toMatch(/YouTube/);
    expect(errors.join(" ")).toMatch(/เอกสาร/);
  });
});
