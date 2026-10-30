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
const pages = fs.readdirSync(publicDir).filter((f) => f.endsWith(".html"));
const html = (f) => fs.readFileSync(path.join(publicDir, f), "utf8");

test("all expected pages exist", () => {
  for (const f of [
    "index.html",
    "why-this.html",
    "privacy.html",
    "terms.html",
    "404.html",
  ]) {
    assert.ok(pages.includes(f), `${f} is missing`);
  }
});

for (const page of pages) {
  test(`${page}: structure, accessibility basics, and shared parts`, () => {
    const text = html(page);
    assert.match(text, /<html lang="en">/, "lang attribute");
    assert.match(text, /<meta name="viewport"/, "viewport");
    assert.match(
      text,
      /<link rel="icon" type="image\/png" href="\/images\/favicon-48\.png"/,
      "favicon",
    );
    assert.match(
      text,
      /<script src="\/js\/theme-init\.js"><\/script>/,
      "no-flash theme script",
    );
    assert.ok(
      text.indexOf("theme-init.js") < text.indexOf('rel="stylesheet"'),
      "theme script before styles",
    );
    assert.match(text, /class="skip-link" href="#main"/, "skip link");
    assert.match(text, /<div id="site-header"><\/div>/, "header mount");
    assert.match(text, /<div id="site-footer"><\/div>/, "footer mount");
    assert.match(text, /<main id="main"/, "main landmark");
    assert.equal((text.match(/<h1[ >]/g) || []).length, 1, "exactly one h1");
    assert.match(text, /\/css\/pages\.css/, "footer styles loaded");
    assert.match(text, /<noscript>/, "noscript notice");
    assert.doesNotMatch(
      text,
      /onclick=|style="/i,
      "no inline handlers or inline styles (CSP)",
    );
    assert.doesNotMatch(
      text,
      /<script(?![^>]*src=)[^>]*>/i,
      "no inline scripts (CSP)",
    );
  });
}

test("the content pages have a link back to the ATM finder", () => {
  for (const f of ["why-this.html", "privacy.html", "terms.html", "404.html"]) {
    assert.match(
      html(f),
      /<a class="btn btn--primary" href="\/" data-i18n="common\.backToFinder">/,
      f,
    );
  }
});

test("Why This? page contains every section the project requires", () => {
  const text = html("why-this.html");
  for (const key of [
    "problem",
    "solution",
    "how",
    "transparency",
    "security",
    "purpose",
    "limits",
  ]) {
    assert.match(text, new RegExp(`data-i18n="whyThis\\.${key}\\.title"`), key);
  }
  for (let i = 1; i <= 5; i += 1)
    assert.match(text, new RegExp(`whyThis\\.how\\.step${i}"`), `step ${i}`);
});

test("Privacy and Terms pages show a last updated date", () => {
  for (const f of ["privacy.html", "terms.html"])
    assert.match(html(f), /id="last-updated"/, f);
});

test("every translation key used in pages and scripts exists in all three languages", () => {
  const dictionaries = ["en", "te", "hi"].map((l) =>
    JSON.parse(
      fs.readFileSync(path.join(publicDir, "locales", `${l}.json`), "utf8"),
    ),
  );
  const has = (dict, key) => {
    let node = dict;
    for (const part of key.split(".")) {
      if (node === null || typeof node !== "object" || !(part in node))
        return false;
      node = node[part];
    }
    return typeof node === "string";
  };
  const hasPlural = (dict, key) =>
    has(dict, `${key}_one`) && has(dict, `${key}_other`);

  const files = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "locales") walk(full);
      } else if (/\.(js|html)$/.test(entry.name)) files.push(full);
    }
  })(publicDir);

  const used = new Set();
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(
      /data-(?:i18n(?:-[a-z-]+)?|title-key|description-key)=["']([\w.]+)["']/g,
    ))
      used.add(m[1]);
    for (const m of src.matchAll(/'data-i18n(?:-[a-z-]+)?':\s*'([\w.]+)'/g))
      used.add(m[1]);
    for (const m of src.matchAll(/\bt\(\s*'([\w.]+)'/g)) used.add(m[1]);
    for (const m of src.matchAll(
      /key:\s*'((?:nav|footer|search|results|report|auth|detail|map|common)\.[\w.]+)'/g,
    ))
      used.add(m[1]);
  }
  const dynamic = [];
  for (const s of ["AVAILABLE", "UNAVAILABLE", "UNKNOWN"])
    dynamic.push(`status.${s}`);
  for (const s of ["simulated", "community"]) dynamic.push(`source.${s}`);
  for (const s of ["HIGH", "MEDIUM", "LOW", "SIMULATED", "NONE"])
    dynamic.push(`reliability.${s}`);

  const missing = [];
  for (const key of [...used, ...dynamic]) {
    dictionaries.forEach((dict, i) => {
      if (!has(dict, key) && !hasPlural(dict, key))
        missing.push(`${["en", "te", "hi"][i]}:${key}`);
    });
  }
  assert.deepEqual(missing, []);
  assert.ok(used.size > 100, `expected to find many keys, found ${used.size}`);
});
