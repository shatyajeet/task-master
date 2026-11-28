// yarn check:arch: checks the code against docs/architecture.md, automatically.
// Uses only Node built-ins. `check(root)` returns violations; the command line prints them
// as `<file>:<line> <rule> <message>` and exits 1 if there are any.
//
// There is no inline way to skip a rule. A rule that is wrong is changed here, with the user's agreement.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mjs", ".js", ".py"]);
const SOURCE_EXCLUDED_DIRS = new Set(["node_modules", ".venv", ".next", "docs"]);
const TEST_DIRS = new Set(["test", "tests", "e2e"]);
const ALLOWED_PORTS = new Set([3000, 3001, 5432, 8000, 8001, 8099, 11434]);
const BANNED_IMPORTS = ["redis", "ioredis", "bullmq", "neo4j", "neo4j-driver", "celery", "kafka"];
const README_MAX_LINES = 450;

// The checker and its tests must spell out every forbidden pattern to test it, so the source
// rules (A2 to A7) do not read these two files. Their manifests and the other rules still apply.
const SELF_FILES = new Set(["scripts/check-architecture.mjs", "scripts/check-architecture.test.mjs"]);

// ---------------------------------------------------------------- files

function listFiles(root) {
  let files;
  try {
    const out = execFileSync(
      "git",
      ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 },
    );
    files = out.split("\0").filter(Boolean);
  } catch {
    files = walk(root, "");
  }
  return [...new Set(files)].filter((f) => existsSync(join(root, f))).sort();
}

function walk(root, rel) {
  const out = [];
  for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".venv") continue;
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(root, child));
    else out.push(child);
  }
  return out;
}

function readText(root, rel) {
  const buf = readFileSync(join(root, rel));
  return buf.includes(0) ? null : buf.toString("utf8");
}

const segmentsOf = (rel) => rel.split("/");
const dirsOf = (rel) => segmentsOf(rel).slice(0, -1);
const isSource = (rel) =>
  SOURCE_EXTENSIONS.has(extname(rel)) && !segmentsOf(rel).some((s) => SOURCE_EXCLUDED_DIRS.has(s));
const isTest = (rel) => dirsOf(rel).some((d) => TEST_DIRS.has(d));

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

// ---------------------------------------------------------------- rules

function ruleDeps(ctx, add) {
  let allow = {};
  try {
    allow = JSON.parse(readFileSync(join(ctx.root, "docs/build/allowed-dependencies.json"), "utf8"));
  } catch {
    // No allowlist: every declared name is a violation.
  }
  const normalizeRequirement = (name) => name.toLowerCase().replaceAll("_", "-");

  for (const rel of ctx.files) {
    const isNpm = rel === "package.json" || /^(apps|services)\/[^/]+\/package\.json$/.test(rel);
    const isReq = /^services\/[^/]+\/requirements[^/]*\.in$/.test(rel);
    if (!isNpm && !isReq) continue;
    const text = ctx.text(rel);
    if (text === null) continue;
    const listed = Array.isArray(allow[rel]) ? allow[rel] : null;

    if (isNpm) {
      let pkg;
      try {
        pkg = JSON.parse(text);
      } catch {
        add(rel, 1, "A1-deps", "package.json is not valid JSON");
        continue;
      }
      for (const field of ["dependencies", "devDependencies"]) {
        for (const name of Object.keys(pkg[field] ?? {})) {
          if (listed && listed.includes(name)) continue;
          const at = text.indexOf(`"${name}"`);
          add(rel, at < 0 ? 1 : lineOf(text, at), "A1-deps", dependencyMessage(name, rel, listed));
        }
      }
    } else {
      const allowed = new Set((listed ?? []).map(normalizeRequirement));
      text.split("\n").forEach((raw, i) => {
        const line = raw.replace(/#.*$/, "").trim();
        if (!line || line.startsWith("-")) return;
        const m = /^[A-Za-z0-9][A-Za-z0-9._-]*/.exec(line);
        if (!m) return;
        const name = normalizeRequirement(m[0]);
        if (!allowed.has(name)) add(rel, i + 1, "A1-deps", dependencyMessage(m[0], rel, listed));
      });
    }
  }
}

function dependencyMessage(name, rel, listed) {
  return listed
    ? `"${name}" is not in allowed-dependencies.json for ${rel}`
    : `"${name}" is declared, but ${rel} is not in allowed-dependencies.json`;
}

function packageScripts(ctx) {
  const out = [];
  for (const rel of ctx.files) {
    if (!(rel === "package.json" || /^(apps|services)\/[^/]+\/package\.json$/.test(rel))) continue;
    const text = ctx.text(rel);
    if (text === null) continue;
    let pkg;
    try {
      pkg = JSON.parse(text);
    } catch {
      continue;
    }
    for (const [name, value] of Object.entries(pkg.scripts ?? {})) {
      const at = text.indexOf(`"${name}"`);
      out.push({ rel, line: at < 0 ? 1 : lineOf(text, at), name, value: String(value) });
    }
  }
  return out;
}

function ruleBind(ctx, add) {
  const wildcard = /0\.0\.0\.0|"::"|'::'|INADDR_ANY/;
  const message = "binds or mentions a wildcard address; bind to 127.0.0.1 only";

  for (const { rel, line, name, value } of packageScripts(ctx)) {
    if (wildcard.test(value)) add(rel, line, "A2-bind", `script "${name}" ${message}`);
    if (/\bnext\s+(dev|start)\b/.test(value) && !/(?:-H|--hostname)[ =]127\.0\.0\.1(?![\d.])/.test(value)) {
      add(rel, line, "A2-bind", `script "${name}" runs next without -H 127.0.0.1`);
    }
  }

  for (const rel of ctx.sourceFiles()) {
    if (isTest(rel)) continue;
    const text = ctx.text(rel);
    if (text === null) continue;
    const isApi = rel.startsWith("apps/api/src/");
    const hostPy = /\bhost\s*=(?!=)\s*(["'])([^"'\n]*)\1/;
    const hostTs = /\bhost\s*:\s*(["'`])([^"'`\n]*)\1/;
    text.split("\n").forEach((line, i) => {
      if (wildcard.test(line)) add(rel, i + 1, "A2-bind", message);
      const m = rel.endsWith(".py") ? hostPy.exec(line) : isApi ? hostTs.exec(line) : null;
      if (m && m[2] !== "127.0.0.1") {
        add(rel, i + 1, "A2-bind", `host is "${m[2]}"; it must be "127.0.0.1"`);
      }
    });
  }
}

function ruleComponents(ctx, add) {
  for (const rel of ctx.files) {
    const name = basename(rel);
    if (
      name === "Dockerfile" ||
      name === ".dockerignore" ||
      /^docker-compose.*\.yml$/.test(name) ||
      /^compose\.y.*ml$/.test(name)
    ) {
      add(rel, 1, "A3-components", `${name} found: TaskMaster runs natively, with no Docker`);
    }
  }

  const names = BANNED_IMPORTS.map((n) => n.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")).join("|");
  const py = new RegExp(`^\\s*(?:import|from)\\s+(${names})\\b`);
  const js = new RegExp(`(?:\\bfrom|\\bimport|\\brequire\\()\\s*\\(?\\s*["'](${names})(?:/[^"']*)?["']`);
  for (const rel of ctx.sourceFiles()) {
    const text = ctx.text(rel);
    if (text === null) continue;
    const re = rel.endsWith(".py") ? py : js;
    text.split("\n").forEach((line, i) => {
      const m = re.exec(line);
      if (m) add(rel, i + 1, "A3-components", `imports "${m[1]}": there is no Redis, Neo4j, queue or broker`);
    });
  }
}

function rulePorts(ctx, add) {
  const re = /(?:\bport\s*[=:]\s*|--port[ =]\s*|(?:^|\s)-p\s+)(\d{1,5})\b/gi;
  const scan = (rel, line, text) => {
    for (const m of text.matchAll(re)) {
      if (!ALLOWED_PORTS.has(Number(m[1]))) {
        add(rel, line, "A4-ports", `port ${m[1]} is not one of ${[...ALLOWED_PORTS].join(", ")}`);
      }
    }
  };
  for (const { rel, line, value } of packageScripts(ctx)) scan(rel, line, value);
  for (const rel of ctx.sourceFiles()) {
    if (isTest(rel)) continue;
    const text = ctx.text(rel);
    if (text === null) continue;
    text.split("\n").forEach((line, i) => scan(rel, i + 1, line));
  }
}

function ruleSql(ctx, add) {
  const pyBad = [
    [/\bexecute(?:many)?\(\s*[a-zA-Z]*[fF][a-zA-Z]*("""|'''|"|')/g, "an f-string"],
    [/\bexecute(?:many)?\(\s*[rbuRBU]?("""|'''|"|')(?:(?!\1)[\s\S])*?\1\s*\.format\(/g, ".format()"],
    [/\bexecute(?:many)?\(\s*[rbuRBU]?("""|'''|"|')(?:(?!\1)[\s\S])*?\1\s*%/g, "% formatting"],
  ];
  const tsBad = /\bquery\(\s*`[^`]*\$\{/g;
  for (const rel of ctx.sourceFiles()) {
    const text = ctx.text(rel);
    if (text === null) continue;
    if (rel.endsWith(".py") && /^services\/[^/]+\/app\//.test(rel)) {
      for (const [re, what] of pyBad) {
        for (const m of text.matchAll(re)) {
          add(rel, lineOf(text, m.index), "A5-sql", `execute() is given a query built with ${what}; use parameters`);
        }
      }
    } else if (/^apps\/api\/src\//.test(rel) && extname(rel) !== ".py") {
      for (const m of text.matchAll(tsBad)) {
        add(rel, lineOf(text, m.index), "A5-sql", "query() is given a template literal with ${}; use parameters");
      }
    }
  }
}

function ruleRender(ctx, add) {
  for (const rel of ctx.files) {
    if (!rel.startsWith("apps/web/")) continue;
    const text = ctx.text(rel);
    if (text === null) continue;
    text.split("\n").forEach((line, i) => {
      for (const word of ["rehype-raw", "dangerouslySetInnerHTML"]) {
        if (line.includes(word)) add(rel, i + 1, "A6-render", `${word} is not allowed: model output is never rendered as HTML`);
      }
    });
  }
  const config = "apps/web/next.config.ts";
  if (ctx.files.includes(config)) {
    const text = ctx.text(config) ?? "";
    const missing = ["img-src 'self' data:", "frame-src 'none'"].filter((s) => !text.includes(s));
    if (missing.length) add(config, 1, "A6-render", `the CSP lacks ${missing.map((s) => `"${s}"`).join(" and ")}`);
  }
}

function ruleTestNet(ctx, add) {
  const re = /https?:\/\/([^\s/"'`:?#)\]>\\]*)/gi;
  for (const rel of ctx.sourceFiles()) {
    if (!isTest(rel)) continue;
    const text = ctx.text(rel);
    if (text === null) continue;
    text.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(re)) {
        const host = m[1].toLowerCase();
        if (!host || host.includes("{") || host.includes("$")) continue;
        if (host === "127.0.0.1" || host === "localhost" || host.endsWith(".example")) continue;
        add(rel, i + 1, "A7-test-net", `test uses ${m[0]}: tests may only call 127.0.0.1, localhost or *.example`);
      }
    });
  }
}

function ruleArchCommit(ctx, add) {
  let out;
  try {
    out = execFileSync("git", ["-C", ctx.root, "status", "--porcelain", "-uall", "-z"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return; // not a git repository
  }
  const entries = out.split("\0").filter(Boolean);
  const paths = [];
  for (let i = 0; i < entries.length; i++) {
    const status = entries[i].slice(0, 2);
    paths.push(entries[i].slice(3));
    if (status.includes("R") || status.includes("C")) i++; // the next entry is the original path
  }
  if (!paths.includes("docs/architecture.md")) return;
  const others = paths.filter((p) => !p.startsWith("docs/"));
  if (others.length) {
    add(
      "docs/architecture.md",
      1,
      "A8-arch-commit",
      `changed together with ${others.slice(0, 3).join(", ")}${others.length > 3 ? ", ..." : ""}: commit it alone as "ARCH: <summary>"`,
    );
  }
}

// ---- A9: README.md

function githubSlug(heading) {
  const text = heading
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/[*~]/g, "")
    .trim()
    .toLowerCase();
  return text.replace(/[^\p{L}\p{N}\p{M}_\- ]/gu, "").replaceAll(" ", "-");
}

// Lines outside fenced code blocks, with their numbers.
function proseLines(text) {
  const out = [];
  let fence = null;
  text.split("\n").forEach((line, i) => {
    const m = /^\s*(```+|~~~+)/.exec(line);
    if (m) {
      if (!fence) fence = m[1][0];
      else if (m[1][0] === fence) fence = null;
      return;
    }
    if (!fence) out.push({ n: i + 1, line });
  });
  return out;
}

function headingsOf(text) {
  const slugs = new Map();
  const out = [];
  for (const { n, line } of proseLines(text)) {
    const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const base = githubSlug(m[2]);
    const seen = slugs.get(base) ?? 0;
    slugs.set(base, seen + 1);
    out.push({ n, level: m[1].length, text: m[2], slug: seen ? `${base}-${seen}` : base });
  }
  return out;
}

function ruleReadme(ctx, add) {
  const rel = "README.md";
  if (!ctx.files.includes(rel)) return;
  const text = ctx.text(rel);
  if (text === null) return;

  const lines = text.split("\n");
  const count = lines.at(-1) === "" ? lines.length - 1 : lines.length;
  if (count > README_MAX_LINES) {
    add(rel, README_MAX_LINES + 1, "A9-readme", `README.md has ${count} lines; the limit is ${README_MAX_LINES}`);
  }

  const headings = headingsOf(text);
  const titles = headings.filter((h) => h.level === 1);
  for (const extra of titles.slice(1)) {
    add(rel, extra.n, "A9-readme", `a second "#" heading ("${extra.text}"): use one title and "##" for sections`);
  }

  const slugCache = new Map([[rel, headings.map((h) => h.slug)]]);
  const slugsOf = (target) => {
    if (!slugCache.has(target)) slugCache.set(target, headingsOf(ctx.text(target) ?? "").map((h) => h.slug));
    return slugCache.get(target);
  };

  for (const { n, line } of proseLines(text)) {
    const prose = line.replace(/`[^`]*`/g, "");
    for (const m of prose.matchAll(/\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
      const href = m[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
      const hash = href.indexOf("#");
      const path = hash < 0 ? href : href.slice(0, hash);
      const anchor = hash < 0 ? "" : href.slice(hash + 1);
      const target = path ? posix.normalize(decodeURI(path)).replace(/\/$/, "") : rel;
      if (!existsSync(join(ctx.root, target))) {
        add(rel, n, "A9-readme", `link to "${href}" points to a missing file`);
        continue;
      }
      if (anchor && target.endsWith(".md") && !slugsOf(target).includes(decodeURI(anchor).toLowerCase())) {
        add(rel, n, "A9-readme", `link "${href}": no heading in ${target} has the anchor #${anchor}`);
      }
    }
  }

  // The links under "## Contents" must match the "##" headings after it, in order.
  const contentsAt = headings.findIndex((h) => h.level === 2 && h.text.toLowerCase() === "contents");
  if (contentsAt < 0) {
    add(rel, 1, "A9-readme", 'README.md has no "## Contents" section');
    return;
  }
  const contents = headings[contentsAt];
  const following = headings.slice(contentsAt + 1).filter((h) => h.level === 2);
  const end = following.length ? following[0].n : lines.length + 1;
  const listed = [];
  for (const { n, line } of proseLines(text)) {
    if (n <= contents.n || n >= end) continue;
    for (const m of line.matchAll(/\[[^\]]*\]\(#([^)\s]+)\)/g)) listed.push(m[1].toLowerCase());
  }
  const expected = following.map((h) => h.slug);
  if (listed.join("\n") !== expected.join("\n")) {
    const firstDiff = expected.findIndex((s, i) => listed[i] !== s);
    const detail =
      listed.length !== expected.length
        ? `${listed.length} links for ${expected.length} sections`
        : `entry ${firstDiff + 1} is #${listed[firstDiff]}, expected #${expected[firstDiff]}`;
    add(rel, contents.n, "A9-readme", `the Contents list differs from the "##" headings: ${detail}`);
  }
}

// ---------------------------------------------------------------- entry points

export function check(root = defaultRoot()) {
  root = resolve(root);
  const files = listFiles(root);
  const cache = new Map();
  const ctx = {
    root,
    files,
    text(rel) {
      if (!cache.has(rel)) cache.set(rel, readText(root, rel));
      return cache.get(rel);
    },
    sourceFiles() {
      return files.filter((f) => isSource(f) && !SELF_FILES.has(f));
    },
  };

  const found = new Map();
  const add = (file, line, rule, message) => {
    const key = `${file}:${line}:${rule}`; // one violation per rule per line
    if (!found.has(key)) found.set(key, { file, line, rule, message });
  };

  ruleDeps(ctx, add);
  ruleBind(ctx, add);
  ruleComponents(ctx, add);
  rulePorts(ctx, add);
  ruleSql(ctx, add);
  ruleRender(ctx, add);
  ruleTestNet(ctx, add);
  ruleArchCommit(ctx, add);
  ruleReadme(ctx, add);

  return [...found.values()].sort(
    (a, b) =>
      (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) || a.line - b.line || (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0),
  );
}

function defaultRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

function main() {
  const args = process.argv.slice(2);
  const at = args.indexOf("--root");
  const root = at >= 0 && args[at + 1] ? args[at + 1] : defaultRoot();
  const violations = check(root);
  for (const v of violations) console.log(`${v.file}:${v.line} ${v.rule} ${v.message}`);
  if (violations.length) {
    console.log(`check:arch: ${violations.length} violation${violations.length === 1 ? "" : "s"}`);
    process.exit(1);
  }
  console.log("check:arch: ok");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
