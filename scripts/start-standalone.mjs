/**
 * Railway/Docker set HOSTNAME to the container id — Next.js then binds to that
 * hostname only and the edge proxy returns 502. Always listen on 0.0.0.0.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.HOSTNAME = "0.0.0.0";

const root = path.dirname(fileURLToPath(import.meta.url));
const server = path.join(root, "..", ".next", "standalone", "server.js");

const child = spawn(process.execPath, [server], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
