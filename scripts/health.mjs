// node scripts/health.mjs: waits for all four services to answer, for up to 60 seconds.
// Exits 0 once every one has responded, and 1 otherwise.
const CHECKS = [
  { name: "web", url: "http://127.0.0.1:3000/" },
  { name: "api", url: "http://127.0.0.1:3001/health" },
  { name: "agent", url: "http://127.0.0.1:8000/health" },
  { name: "ocr", url: "http://127.0.0.1:8001/health" },
];
const DEADLINE_MS = 60_000;
const INTERVAL_MS = 1_000;
const REQUEST_TIMEOUT_MS = 15_000; // the first request to the Next.js dev server compiles the page

const up = new Set();
const started = Date.now();

async function probe({ name, url }) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (response.ok) {
      up.add(name);
      console.log(`${name}: ok (${url})`);
    }
    await response.body?.cancel();
  } catch {
    // Not up yet; try again on the next round.
  }
}

while (up.size < CHECKS.length && Date.now() - started < DEADLINE_MS) {
  await Promise.all(CHECKS.filter((c) => !up.has(c.name)).map(probe));
  if (up.size < CHECKS.length) await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
}

if (up.size === CHECKS.length) {
  console.log("all four services are up");
  process.exit(0);
}
const missing = CHECKS.filter((c) => !up.has(c.name)).map((c) => c.name);
console.error(`not up after ${DEADLINE_MS / 1000} s: ${missing.join(", ")}`);
process.exit(1);
