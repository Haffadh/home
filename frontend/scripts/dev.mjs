#!/usr/bin/env node
/**
 * Run Next.js dev from the frontend package directory only.
 * Ensures Next finds app/ even when npm is run from workspace root.
 */
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, "..");
process.chdir(frontendRoot);

const child = spawn("npx", ["next", "dev"], {
  stdio: "inherit",
  cwd: frontendRoot,
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 0));
