/**
 * Next.js standalone output does not include public/ or .next/static by default.
 * Railway/Linux build — copy after `next build`.
 */
import { cpSync, existsSync, mkdirSync } from "fs";
import path from "path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  console.log("copy-standalone-assets: no standalone output, skip");
  process.exit(0);
}

const publicSrc = path.join(root, "public");
const publicDest = path.join(standalone, "public");
if (existsSync(publicSrc)) {
  cpSync(publicSrc, publicDest, { recursive: true });
}

const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standalone, ".next", "static");
mkdirSync(path.dirname(staticDest), { recursive: true });
if (existsSync(staticSrc)) {
  cpSync(staticSrc, staticDest, { recursive: true });
}

console.log("copy-standalone-assets: done");
