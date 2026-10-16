// One-off codemod: replace hardcoded hex utility classes with design tokens.
// Usage: node scripts/theme-sweep.mjs          (dry run)
//        node scripts/theme-sweep.mjs --apply  (write files)
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const APPLY = process.argv.includes("--apply");
const ROOT = process.cwd();
const SRC = join(ROOT, "src");

const TEXT = {
  "#1c1c1b": "ink", "#222222": "ink", "#282b43": "ink", "#2b2e49": "ink",
  "#33332f": "ink", "#343751": "ink", "#424660": "ink", "#303030": "ink",
  "#6558d3": "ink",
  "#55554f": "ink-soft", "#5f6480": "ink-soft", "#65655f": "ink-soft",
  "#66665f": "ink-soft", "#777770": "ink-soft", "#777771": "ink-soft",
  "#777c98": "ink-soft", "#7c7c75": "ink-soft", "#7e829c": "ink-soft",
  "#85857e": "ink-soft", "#858aa5": "ink-soft", "#878ba5": "ink-soft",
  "#888880": "ink-soft", "#8a8a83": "ink-soft", "#8b8b84": "ink-soft",
  "#92928b": "ink-soft", "#55718a": "ink-soft", "#f7f7f5": "ink-soft",
  "#3e425f": "ink-soft", "#3d415d": "ink-soft", "#656a86": "ink-soft",
  "#737895": "ink-soft", "#73736c": "ink-soft",
  "#969ab0": "ink-faint", "#999990": "ink-faint", "#999991": "ink-faint",
  "#9b9b94": "ink-faint", "#9ca0b7": "ink-faint", "#aaa9a1": "ink-faint",
  "#b0b0a8": "ink-faint", "#8b8fa6": "ink-faint", "#a6abc0": "ink-faint",
  "#aaa9a2": "ink-faint", "#999": "ink-faint",
  "#24613b": "positive", "#8f2d2d": "negative", "#9f2d20": "negative",
  "#b42318": "negative", "#89661c": "caution", "#277dbd": "data-1",
  "#14845e": "positive", "#24694f": "positive", "#4f806b": "positive",
  "#245b48": "positive", "#158461": "positive",
  "#9f2d24": "negative",
  "#9a7628": "caution", "#d47a39": "caution",
};

const BG = {
  "#1c1c1b": "accent",
  "#33332f": "ink",
  "#f7f7f4": "muted", "#fafaf8": "muted", "#fafaf7": "muted", "#f7f7f3": "muted",
  "#f5f5f1": "muted", "#f3f3ef": "muted", "#f0f0ec": "muted", "#f0f0eb": "muted",
  "#f1f1ed": "muted", "#efefeb": "muted", "#eeeeea": "muted", "#ecece7": "muted",
  "#f7f8fc": "muted", "#f1efff": "muted", "#e6e6e2": "muted",
  "#f2f2ed": "muted", "#f2f2ee": "muted", "#ecece8": "muted", "#e9e9e4": "muted",
  "#e3e3de": "muted", "#f8f8f5": "muted", "#f7f7f5": "muted", "#fbfaf4": "muted",
  "#f1f2fa": "muted", "#f2f0ff": "muted", "#eeecff": "muted",
  "#d5d5ce": "line/15", "#a3a39b": "line/20",
  "#fff0ee": "negative/10", "#fff7f5": "negative/10", "#faf1ef": "negative/10",
  "#fffaf0": "caution/10", "#fff3e7": "caution/10",
  "#eaf5ff": "data-1/10", "#f5faff": "data-1/[.06]",
  "#f3fcf7": "positive/10", "#f6faf6": "positive/10", "#e8f8f2": "positive/10",
};

const BORDER = {
  "#dfdfda": "line/15", "#d8d8d2": "line/15", "#deded8": "line/15",
  "#e8e8e2": "line/15", "#cfcfc8": "line/20", "#c9c9c1": "line/20",
  "#999990": "ink/40",
  "#dcdcd5": "line/15", "#e5e5df": "line/15", "#d8d8d1": "line/15",
  "#d0d0c8": "line/15", "#e7e7e1": "line/10", "#e2e2dd": "line/10",
  "#a3a39b": "line/20",
  "#eeeeea": "line/10", "#e4e4df": "line/10", "#ecece7": "line/10",
  "#e4e4dd": "line/10", "#eef0f7": "line/10", "#eff0f7": "line/10",
  "#e9eaf3": "line/10", "#f0f1f7": "line/10", "#dfe2ee": "line/10",
  "#1c1c1b": "accent",
  "#ead0cc": "negative/25", "#f3dfb2": "caution/25", "#e1d8c5": "caution/25",
  "#bfe7d5": "positive/25", "#dbeaf8": "data-1/25",
  "#ead7d4": "negative/25", "#d8f0e3": "positive/25", "#dfe8df": "positive/25",
};

const DIVIDE = { "#ecece7": "line/10", "#f0f1f7": "line/10" };
const RING = { "#0000000d": "ink/[.05]" };
const ACCENT = { "#6558d3": "ink" };

const MAP = { text: TEXT, bg: BG, border: BORDER, divide: DIVIDE, ring: RING, accent: ACCENT };

const RE = /\b(text|bg|border|divide|ring|accent)-\[(#[0-9a-fA-F]{3,8})\](?:\/([0-9.]+|\[[^\]]+\]))?/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(p);
  }
  return out;
}

const perFile = new Map();
const unmapped = new Map();
let total = 0;

for (const file of walk(SRC)) {
  const original = readFileSync(file, "utf8");
  const next = original.replace(RE, (full, prefix, rawHex, opacity) => {
    const hex = rawHex.toLowerCase();
    const token = MAP[prefix]?.[hex];
    if (!token) {
      unmapped.set(`${prefix}-[${hex}]`, (unmapped.get(`${prefix}-[${hex}]`) || 0) + 1);
      return full;
    }
    const out = token.includes("/") ? `${prefix}-${token}` : `${prefix}-${token}${opacity ? `/${opacity}` : ""}`;
    const list = perFile.get(file) ?? [];
    list.push(`${full}  ->  ${out}`);
    perFile.set(file, list);
    total += 1;
    return out;
  });
  if (next !== original && APPLY) writeFileSync(file, next, "utf8");
}

for (const [file, list] of [...perFile.entries()].sort()) {
  console.log(`\n${relative(ROOT, file)}  (${list.length})`);
  for (const line of list.slice(0, 12)) console.log("   " + line);
  if (list.length > 12) console.log(`   … +${list.length - 12} more`);
}
console.log(`\nTOTAL replacements: ${total}   (${APPLY ? "APPLIED" : "dry run"})`);
if (unmapped.size) {
  console.log("\nUNMAPPED (left untouched):");
  for (const [k, v] of [...unmapped.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${String(v).padStart(3)}  ${k}`);
}
