import { cp, rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const source = join(root, "web", "out");
const target = join(root, "public");

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });
console.log(`Copied ${source} -> ${target}`);
