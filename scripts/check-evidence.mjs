// Validates the recorded evidence: pinned bytes, the frozen file the patch targets, and the
// RED -> GREEN markers in both recorded runs.
//
// This check is fail-closed by construction. A missing artifact, an unhashed artifact, a
// hashed artifact that is no longer tracked, or a marker that stopped appearing all exit
// non-zero. It never reports on an empty set.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { HASHED_ARTIFACTS, frozenTargetFile, sha256 } from "./lib/evidence.mjs";

const root = path.resolve(import.meta.dirname, "..");
const readText = (name) => readFileSync(path.join(root, name), "utf8");
const readBytes = (name) => readFileSync(path.join(root, name));

const hashes = JSON.parse(readText("evidence/hashes.json"));
const freeze = JSON.parse(readText("research/target-freeze.json"));
const scan = JSON.parse(readText("evidence/duplicate-scan-2026-07-30.json"));
const baseline = readText("evidence/baseline-output.txt");
const patched = readText("evidence/patched-output.txt");

const checks = [];
const check = (name, passed) => checks.push([name, passed]);

check("hash manifest is not empty", Object.keys(hashes.files ?? {}).length > 0);
check("hash algorithm is sha256", hashes.algorithm === "sha256");

for (const file of HASHED_ARTIFACTS) {
  const recorded = hashes.files?.[file];
  check(`hash recorded for ${file}`, typeof recorded === "string");
  check(
    `bytes unchanged: ${file}`,
    recorded === sha256(readBytes(file)),
  );
}

// Drift in either direction is a failure: an evidence or patch file that nobody hashed is
// exactly the artifact a reader would have no way to check.
const trackedArtifacts = execFileSync(
  "git",
  ["ls-files", "evidence", "patches"],
  { cwd: root, encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean)
  .filter((file) => file !== "evidence/hashes.json");
const hashedSet = new Set(HASHED_ARTIFACTS);
check(
  "every tracked evidence/patch file is hashed",
  trackedArtifacts.every((file) => hashedSet.has(file)),
);
check(
  "every hashed file is tracked",
  HASHED_ARTIFACTS.every((file) => trackedArtifacts.includes(file)),
);

// The patch is only meaningful against the exact file it was generated from.
const target = frozenTargetFile(root);
check(
  "the frozen target file is the one the patch was cut against",
  hashes.frozenTargetFile?.sha256 === sha256(readFileSync(target.absolutePath)),
);
check(
  "the hashed target path is the patched file",
  hashes.frozenTargetFile?.path === target.relativePath,
);

check("frozen before results", freeze.resultsRunBeforeFreeze === false);
check("full SHA", /^[0-9a-f]{40}$/.test(freeze.commitSha));
check("Apache-2.0", freeze.license === "Apache-2.0");
check("27 duplicate queries", scan.queryCount === 27);

const injectedFailures = (text) =>
  (text.match(/ERROR Error processing issue #(?:101|202|303):/g) ?? []).length;

check("baseline: mode label", baseline.startsWith("MODE=baseline"));
check("baseline: three injected failures", injectedFailures(baseline) === 3);
check(
  "baseline: false-success summary",
  baseline.includes("Successfully processed 3 issues."),
);
check("baseline: recorded exit 0", baseline.includes("STALE_MAIN_EXIT_CODE=0"));
check(
  "baseline: sibling metrics tuple after error",
  baseline.includes("SIBLING_RETURNED_AFTER_ERROR=true"),
);

check("patched: mode label", patched.startsWith("MODE=patched"));
check("patched: three injected failures", injectedFailures(patched) === 3);
check(
  "patched: zero counted successes",
  patched.includes("Successfully processed 0 issues."),
);
check(
  "patched: failed issues listed",
  /Failed to process 3 issues: \[101, 202, 303\]/.test(patched),
);
check(
  "patched: recorded non-zero exit",
  /STALE_MAIN_EXIT_CODE=(?!0\b)\d+/.test(patched),
);

const homePath = ["/", "Users", "/"].join("");
check(
  "no local home path in recorded evidence",
  !baseline.includes(homePath) && !patched.includes(homePath),
);

for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
}
if (checks.some(([, passed]) => !passed)) process.exit(1);
console.log(`evidence check: PASS (${checks.length} assertions)`);
