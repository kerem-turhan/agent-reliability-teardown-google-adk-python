// Regenerates evidence/hashes.json. Run this after a recorded run changes; `npm run
// evidence:check` is what enforces the result.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { HASHED_ARTIFACTS, frozenTargetFile, sha256 } from "./lib/evidence.mjs";

const root = path.resolve(import.meta.dirname, "..");
const entries = {};
for (const file of HASHED_ARTIFACTS) {
  entries[file] = sha256(readFileSync(path.join(root, file)));
}

const target = frozenTargetFile(root);
const manifest = {
  schemaVersion: 1,
  algorithm: "sha256",
  files: entries,
  frozenTargetFile: {
    path: target.relativePath,
    sha256: sha256(readFileSync(target.absolutePath)),
  },
};

writeFileSync(
  path.join(root, "evidence", "hashes.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(`hashed ${HASHED_ARTIFACTS.length} artifacts + the frozen target file`);
