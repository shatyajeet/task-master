// Runs a service's venv Python from the repository root: node scripts/py.mjs <agent|ocr> <args...>
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [service, ...args] = process.argv.slice(2);

if (service !== "agent" && service !== "ocr") {
  console.error("usage: node scripts/py.mjs <agent|ocr> <args...>");
  process.exit(2);
}

const serviceDir = join(root, "services", service);
const python = join(serviceDir, ".venv", "Scripts", "python.exe");
if (!existsSync(python)) {
  console.error(`missing ${python}: create the venv first (see README, Setup step 4)`);
  process.exit(2);
}

const result = spawnSync(python, args, {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PYTHONPATH: `${serviceDir};${root}` },
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
