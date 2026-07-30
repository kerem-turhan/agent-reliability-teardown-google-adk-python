import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";

// Artifacts whose bytes are pinned. `evidence:check` fails if this list and the tracked
// files under evidence/ and patches/ ever disagree, so adding an artifact without hashing
// it is a red run rather than an unnoticed gap.
export const HASHED_ARTIFACTS = [
  "evidence/baseline-output.txt",
  "evidence/patched-output.txt",
  "evidence/red-green-summary.md",
  "evidence/duplicate-scan-2026-07-30.json",
  "patches/adk_stale_agent-fail-closed.patch",
];

export const TARGET_FILE =
  "contributing/samples/adk_team/adk_stale_agent/main.py";

export const sha256 = (buffer) =>
  createHash("sha256").update(buffer).digest("hex");

export function frozenTargetFile(root) {
  const absolutePath = path.join(root, ".work", "upstream", TARGET_FILE);
  if (!existsSync(absolutePath)) {
    console.error(
      `frozen target file missing: ${TARGET_FILE}\nrun \`npm run target:checkout\` first`,
    );
    process.exit(1);
  }
  return { absolutePath, relativePath: TARGET_FILE };
}
