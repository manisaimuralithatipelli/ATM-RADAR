import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const publicDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
);

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}

test('no AI provenance metadata (C2PA) or "made with AI" labels in public files', () => {
  for (const file of files(publicDir)) {
    if (!/\.(svg|html|js|css|json|txt)$/.test(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(
      text,
      /c2pa|content credentials|made with (ai|claude)|generated (by|with) (ai|claude)/i,
      file,
    );
  }
});

test("a favicon exists and every page links to it", () => {
  assert.ok(fs.existsSync(path.join(publicDir, "images", "favicon-48.png")));
  for (const page of fs
    .readdirSync(publicDir)
    .filter((f) => f.endsWith(".html"))) {
    assert.match(
      fs.readFileSync(path.join(publicDir, page), "utf8"),
      /rel="icon"/,
      page,
    );
  }
});

test("style rules: no gradients, keyframe animations, or custom cursors in CSS", () => {
  for (const file of files(path.join(publicDir, "css"))) {
    const css = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(css, /gradient\(/i, file);
    assert.doesNotMatch(css, /@keyframes/i, file);
    assert.doesNotMatch(css, /cursor:\s*url/i, file);
  }
});

test('no "college" or "demonstration project" wording in any language', () => {
  const pattern =
    /college|demonstration project|\u0C15\u0C33\u0C3E\u0C36\u0C3E\u0C32|\u0915\u0949\u0932\u0947\u091C/i;
  for (const file of files(publicDir)) {
    if (!/\.(html|js|json|css)$/.test(file)) continue;
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), pattern, file);
  }
});
