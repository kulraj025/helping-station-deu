/**
 * Audits dark-mode text contrast without a browser.
 *
 * Dark mode here is a palette remap, not per-component `dark:` variants, so
 * nothing in the type system or the test suite can catch a token that resolves
 * to the wrong colour. This resolves the cascade by hand — light value from
 * `@theme` / the Tailwind defaults, then `.dark { ... }`, then any pin rule
 * whose selector matches the classes on the element — and checks the contrast
 * of every text/background pair that actually appears in a `className`.
 *
 * Run `npm run build` first: the Tailwind defaults for `slate-*` and `white`
 * only exist in the compiled stylesheet.
 *
 * Exits non-zero if anything drops below WCAG AA (4.5:1), so it can gate CI.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const cssDir = join(ROOT, ".next/static/css");
if (!existsSync(cssDir) || !readdirSync(cssDir).some((f) => f.endsWith(".css"))) {
  console.error("No compiled stylesheet found. Run `npm run build` first.");
  process.exit(1);
}

const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");

// ---- 1. light palette -------------------------------------------------------
const tokens = {};
const themeBlock = css.slice(css.indexOf("@theme {"), css.indexOf("@layer base"));
for (const m of themeBlock.matchAll(/--color-([a-z]+(?:-\d+)?):\s*([^;]+);/g)) {
  if (!tokens[m[1]]) tokens[m[1]] = m[2].trim();
}
const built = readFileSync(join(cssDir, readdirSync(cssDir).find((f) => f.endsWith(".css"))), "utf8");
// Defaults are emitted ahead of our unlayered `.dark` block, so the first
// literal value for a token is the light one. `var(...)` values come from the
// dark block and are resolved later.
for (const m of built.matchAll(/--color-([a-z]+(?:-\d+)?):\s*([^;{}]+)[;}]/g)) {
  if (!tokens[m[1]] && !m[2].trim().startsWith("var(")) tokens[m[1]] = m[2].trim();
}

// ---- 2. dark block: all custom properties, then pins keyed by class ----------
const darkStart = css.indexOf("@media screen {");
const darkSrc = css.slice(darkStart);
const baseBody = darkSrc.match(/\.dark \{([\s\S]*?)\n  \}/)[1];

function decls(body) {
  const out = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const darkVars = decls(baseBody); // includes --surface-*, --brand-*, --line

const pins = [];
for (const m of darkSrc.matchAll(/\.dark ([^{}]+?)\{([^{}]*?)\}/g)) {
  const d = decls(m[2]);
  if (Object.keys(d).length) pins.push({ sel: m[1].trim(), decls: d });
}

// ---- 3. resolve var() chains and convert to sRGB ----------------------------
function deref(value, scope, depth = 0) {
  if (!value || depth > 8) return value;
  const m = value.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/);
  if (!m) return value;
  const ref = m[1].slice(2);
  return deref(scope[ref], scope, depth + 1);
}
function toHex(v, scope = {}) {
  v = deref(String(v).trim(), scope);
  if (v.startsWith("#"))
    return v.length === 4 ? "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3] : v.slice(0, 7).toLowerCase();
  const rgb = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgb)
    return (
      "#" + [rgb[1], rgb[2], rgb[3]].map((n) => Math.round(+n).toString(16).padStart(2, "0")).join("")
    );
  const ok = v.match(/^oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/i);
  if (ok) return oklchToHex(+ok[1] / 100, +ok[2], +ok[3]);
  return null;
}
function oklchToHex(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    "#" +
    lin
      .map((v) => {
        const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(v, 0) ** (1 / 2.4) - 0.055;
        return Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0");
      })
      .join("")
  );
}

// ---- 4. the resolver --------------------------------------------------------
function resolve(token, classes) {
  let value = tokens[token];
  if (value === undefined) return undefined;
  let scope = { ...darkVars };
  const base = darkVars[`color-${token}`];
  if (base) value = base;
  for (const pin of pins) {
    // A pin may list several selectors; it applies if ANY branch matches.
    const branches = pin.sel.split(",").map((s) =>
      s
        .trim()
        .replace(/\\([/])/g, "$1")
        .split(/\s+/)
        .map((t) => t.replace(/^\./, ""))
        // Drop the `.dark` scope prefix and any pseudo-classes; only real
        // classes on the element are required for the pin to apply.
        .filter((t) => t && t !== "dark" && !t.startsWith(":"))
    );
    const matches = branches.some((needed) => needed.length && needed.every((c) => classes.includes(c)));
    if (matches) {
      Object.assign(scope, pin.decls);
      const overridden = pin.decls[`color-${token}`];
      if (overridden) value = overridden;
    }
  }
  return { light: toHex(tokens[token]), dark: toHex(value, scope) };
}

function lum(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = [r, g, b].map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// ---- 5. usage inventory -----------------------------------------------------
// Pairings are read from real `className` strings rather than assumed, because
// most of the codebase pairs each surface with exactly one foreground.
function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(e)) acc.push(p);
  }
  return acc;
}
const files = walk(join(ROOT, "src"));
// Capture the variant prefix too: `text-leaf-700` and `bg-leaf-600` in
// `group-hover:bg-leaf-600 group-hover:text-white` are the same state, and
// pairing a resting foreground with a hover background invents a failure.
const util = /((?:[a-z-]+:)*)((?:bg|text)-(?:leaf|slate|azure|gold|white|canvas)-\d+(?:\/\d+)?)/g;
const inventory = new Map(); // `${state}|${text}|${surface}|${file}` -> count
const allText = new Set();

for (const file of files) {
  const rel = file.slice(ROOT.length + 1);
  for (const m of readFileSync(file, "utf8").matchAll(/["'`]([^"'`\n]{6,})["'`]/g)) {
    const found = [...m[1].matchAll(util)].map((x) => ({ state: x[1], cls: x[2] }));
    if (!found.some((c) => c.cls.startsWith("text-"))) continue;
    for (const t of found.filter((c) => c.cls.startsWith("text-"))) allText.add(t.cls);
    // Only backgrounds in the same variant state are a valid backdrop.
    for (const t of found.filter((c) => c.cls.startsWith("text-"))) {
      const bgs = found.filter((c) => c.cls.startsWith("bg-") && c.state === t.state);
      const surfacesHere = bgs.length ? bgs.map((c) => c.cls) : ["bg-canvas"];
      for (const b of new Set(surfacesHere)) {
        const key = `${t.state}|${t.cls}|${b}|${rel}`;
        inventory.set(key, (inventory.get(key) ?? 0) + 1);
      }
    }
  }
}

const problems = [];
for (const [key, n] of inventory) {
  const [state, t, b, rel] = key.split("|");
  const fg = resolve(t.slice(5), [t]);
  const bg = resolve(b.slice(3), [b]);
  if (!fg?.dark || !bg?.dark) continue;
  const r = ratio(fg.dark, bg.dark);
  if (r < 4.5) problems.push({ t, n, b, fg: fg.dark, bg: bg.dark, r, rel, state });
}
problems.sort((a, b) => a.r - b.r);
console.log("DARK MODE CONTRAST AUDIT — real className pairings, worst first\n");
for (const p of problems) {
  const sev = p.r < 3 ? "FAIL" : "warn";
  console.log(
    `${sev.padEnd(5)} ${p.t.padEnd(16)} on ${p.b.padEnd(15)} ${p.fg} on ${p.bg}  ${p.r
      .toFixed(2)
      .padStart(5)}:1   ${p.state || "(rest)"}${p.rel}`
  );
}
console.log(
  `\n${problems.length} low-contrast pairing(s) out of ${inventory.size} real pairings across ${allText.size} text utilities.`
);
if (problems.length) process.exit(1);

