// yarn dev [--e2e]: starts the web app, the API, the agent and the OCR service, each with its
// output prefixed [web], [api], [agent] or [ocr]. If one of them exits, or on Ctrl+C, it stops all.
// With --e2e it points the services at the test database and a stub LLM, and puts files under .cache/e2e.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const e2e = process.argv.includes("--e2e");

const env = { ...process.env };
if (e2e) {
  if (!env.TEST_DATABASE_URL) {
    console.error("TEST_DATABASE_URL is not set (see .env.example); yarn dev --e2e needs it");
    process.exit(2);
  }
  const uploads = join(root, ".cache", "e2e", "uploads");
  const out = join(root, ".cache", "e2e", "out");
  mkdirSync(uploads, { recursive: true });
  mkdirSync(out, { recursive: true });
  Object.assign(env, {
    DATABASE_URL: env.TEST_DATABASE_URL,
    LLM_BASE_URL: "http://127.0.0.1:8099/v1",
    LLM_MODEL: "stub",
    UPLOAD_DIR: uploads,
    WRITE_DIR: out,
    APPROVAL_TIMEOUT_SECONDS: "86400",
  });
}

const processes = [
  { name: "web", command: "yarn workspace @taskmaster/web dev" },
  { name: "api", command: "yarn workspace @taskmaster/api dev" },
  { name: "agent", command: "node scripts/py.mjs agent -m app.serve" },
  { name: "ocr", command: "node scripts/py.mjs ocr -m app.serve" },
];

if (e2e) {
  // The stub LLM is added in S13. Until it exists there is nothing to start.
  if (existsSync(join(root, "services", "agent", "tests", "stub_llm.py"))) {
    processes.push({
      name: "stub",
      command:
        "node scripts/py.mjs agent -m tests.stub_llm --port 8099 --script services/agent/tests/scripts/default.json",
    });
  } else {
    console.log("[dev] services/agent/tests/stub_llm.py does not exist yet (S13): not starting the stub LLM");
  }
}

const children = [];
let stopping = false;
let exitCode = 0;

function prefixLines(name, stream, target) {
  let pending = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) target.write(`[${name}] ${line}\n`);
  });
  stream.on("end", () => {
    if (pending) target.write(`[${name}] ${pending}\n`);
  });
}

function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const { child } of children) {
    if (child.pid !== undefined && child.exitCode === null) {
      spawnSync("taskkill", ["/T", "/F", "/PID", String(child.pid)], { stdio: "ignore" });
    }
  }
}

for (const { name, command } of processes) {
  // A shell is needed to run `yarn`, which is a .cmd file on Windows. The commands are fixed text.
  const child = spawn(command, { cwd: root, env, shell: true, stdio: ["ignore", "pipe", "pipe"] });
  children.push({ name, child });
  prefixLines(name, child.stdout, process.stdout);
  prefixLines(name, child.stderr, process.stderr);
  child.on("error", (error) => {
    console.error(`[dev] could not start ${name}: ${error.message}`);
    exitCode = 1;
    stopAll();
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`[dev] ${name} exited with code ${code}; stopping the others`);
      exitCode = 1;
    }
    stopAll();
    if (children.every(({ child: c }) => c.exitCode !== null || c.signalCode !== null)) {
      process.exit(exitCode);
    }
  });
}

process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);
process.on("SIGBREAK", stopAll);
