import DOMPurify from "isomorphic-dompurify";

/** Run again on the server before lesson HTML reaches the learner. Videos use a separate allowlisted field. */
export function sanitizeLessonHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "br", "h2", "h3", "h4", "strong", "em", "s", "ul", "ol", "li", "blockquote", "hr", "pre", "code", "a"],
    ALLOWED_ATTR: ["href", "title"],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  });
}
