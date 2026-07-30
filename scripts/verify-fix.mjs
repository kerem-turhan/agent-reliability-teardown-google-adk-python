// Applies the single-file remediation to the frozen target, proves the patched run fails
// closed, and reverses the patch again.
//
// The patch is never vendored into the target's history and never left behind: the run
// starts from a clean checkout at the frozen SHA and ends there, whether the assertions
// passed or not. A run that could not restore the target reports failure rather than
// leaving a modified tree behind a green line.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const targetDir = path.join(root, ".work", "upstream");
const patchPath = path.join(root, "patches", "adk_stale_agent-fail-closed.patch");
const freeze = JSON.parse(
  readFileSync(path.join(root, "research", "target-freeze.json"), "utf8"),
);

function git(args, options = {}) {
  return spawnSync("git", ["-C", targetDir, ...args], {
    encoding: "utf8",
    ...options,
  });
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

const head = git(["rev-parse", "HEAD"]);
if (head.status !== 0 || head.stdout.trim() !== freeze.commitSha) {
  fail(
    `target is not checked out at the frozen SHA (run \`npm run target:checkout\`)`,
  );
}
if (git(["status", "--porcelain"]).stdout.trim() !== "") {
  fail("target tree is dirty before the patch is applied");
}
if (git(["apply", "--check", patchPath]).status !== 0) {
  fail("patch does not apply cleanly to the frozen target");
}

console.log("PASS patch applies cleanly to the frozen target");

let patchApplied = false;
let failure = null;
try {
  if (git(["apply", patchPath]).status !== 0) throw new Error("patch failed to apply");
  patchApplied = true;

  const patched = spawnSync(
    process.execPath,
    [path.join(root, "scripts", "repro-offline.mjs"), "--mode=patched"],
    { cwd: root, encoding: "utf8" },
  );
  process.stdout.write(patched.stdout ?? "");
  process.stderr.write(patched.stderr ?? "");
  if (patched.status !== 0) throw new Error("patched run did not meet its assertions");
  console.log("PASS patched run fails closed");
} catch (error) {
  failure = error;
} finally {
  if (patchApplied) {
    const reversed = git([
      "checkout",
      "--",
      "contributing/samples/adk_team/adk_stale_agent/main.py",
    ]);
    if (reversed.status !== 0) {
      console.error("FAIL could not restore the frozen target file");
      process.exit(1);
    }
  }
}

const after = git(["status", "--porcelain"]).stdout.trim();
if (after !== "") fail(`target tree is not restored after the run:\n${after}`);
const headAfter = git(["rev-parse", "HEAD"]);
if (headAfter.stdout.trim() !== freeze.commitSha) {
  fail("target HEAD moved during the patched run");
}
console.log("PASS target restored to the frozen SHA");

if (failure) fail(failure.message);
