import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

it("sanitizes product HTML in the production CommonJS runtime", () => {
  const html = execFileSync(process.execPath, [
    "--no-experimental-require-module",
    "-e",
    `const clean = require('isomorphic-dompurify').sanitize('<p>ชีทเรียน</p><script>alert(1)</script><a href="javascript:alert(1)">link</a>'); process.stdout.write(clean);`,
  ], { encoding: "utf8" });
  expect(html).toContain("<p>ชีทเรียน</p>");
  expect(html).not.toMatch(/<script|javascript:/i);
});
