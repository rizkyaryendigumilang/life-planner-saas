// Repairs double-encoded (UTF-8 read as cp1252) punctuation in src/.
// Usage: node scripts/fix-encoding.mjs [--apply]
import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const ROOT = "src";

// Each entry: [mojibake sequence, correct character]
// Derivation: the correct char's UTF-8 bytes were decoded as cp1252.
const FIXES = [
  ["\u00e2\u20ac\u201d", "\u2014"], // E2 80 94 -> em dash
  ["\u00e2\u20ac\u201c", "\u2013"], // E2 80 93 -> en dash
  ["\u00e2\u20ac\u00a2", "\u2022"], // E2 80 A2 -> bullet
  ["\u00e2\u20ac\u00a6", "\u2026"], // E2 80 A6 -> ellipsis
  ["\u00e2\u2020\u201c", "\u2193"], // E2 86 93 -> down arrow
  ["\u00e2\u2020\u2018", "\u2191"], // E2 86 91 -> up arrow
  ["\u00e2\u02c6\u2019", "\u2212"], // E2 88 92 -> minus sign
  ["\u00c2\u00b7", "\u00b7"], // C2 B7 -> middle dot
  ["\u00c2\u00a0", "\u00a0"], // C2 A0 -> non-breaking space
  ["\ufeff", ""], // stray BOM
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|css|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

let touched = 0;
let total = 0;
for (const file of walk(ROOT)) {
  const original = fs.readFileSync(file, "utf8");
  let next = original;
  let hits = 0;
  for (const [bad, good] of FIXES) {
    const parts = next.split(bad);
    if (parts.length > 1) {
      hits += parts.length - 1;
      next = parts.join(good);
    }
  }
  if (next !== original) {
    touched++;
    total += hits;
    console.log(`${APPLY ? "fix" : "would fix"} ${file.split(path.sep).join("/")}  (${hits})`);
    if (APPLY) fs.writeFileSync(file, next, "utf8");
  }
}
console.log(`\n${APPLY ? "applied" : "dry run"}: ${total} replacements in ${touched} files`);
