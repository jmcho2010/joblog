// Runs Python from services/ai/.venv on any OS: `node scripts/py.mjs -m pytest`.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const venvBin = process.platform === "win32" ? join("Scripts", "python.exe") : join("bin", "python");
const python = join(root, "services", "ai", ".venv", venvBin);

const result = spawnSync(python, process.argv.slice(2), {
  stdio: "inherit",
  cwd: join(root, "services", "ai"),
});
if (result.error) {
  console.error(`Cannot run ${python}. Create it first with: npm run setup:ai`);
  process.exit(1);
}
process.exit(result.status ?? 1);
