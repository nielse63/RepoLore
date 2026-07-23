/**
 * Manual sanity check for JS/TS source discovery against a fixture directory
 * (no automated test suite yet — see implementation-plan.md session 15).
 *
 * Usage: npm run discover -- fixtures/ts-react-app
 */

import path from "node:path";
import { discoverSourceFiles } from "../src/analysis/js-ts/discovery";

const target = process.argv[2];
if (!target) {
  console.error("Usage: npm run discover -- <path-to-fixture>");
  process.exit(1);
}

const rootDir = path.resolve(target);
const { sourceFiles } = discoverSourceFiles(rootDir);

console.log(`Discovered ${sourceFiles.length} source file(s) under ${rootDir}:`);
for (const sourceFile of sourceFiles) {
  console.log(`  ${path.relative(rootDir, sourceFile.getFilePath())}`);
}
