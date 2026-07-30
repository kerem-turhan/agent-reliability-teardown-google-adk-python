// Runs the frozen stale-agent entry point with deterministic fake boundaries and
// asserts the outcome for the requested mode.
//
// The exit status recorded here is the status of the child process that executed the
// frozen `main.py` as `__main__`. Nothing in this file prints a status of its own: a
// harness that announced its own exit code would be measuring itself, not the target.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const targetDir = path.join(root, ".work", "upstream");

const args = process.argv.slice(2);
const modeArg = args.find((value) => value.startsWith("--mode="));
const mode = modeArg ? modeArg.slice("--mode=".length) : "baseline";
if (mode !== "baseline" && mode !== "patched") {
  console.error(`unknown mode: ${mode} (expected baseline or patched)`);
  process.exit(1);
}
const writeArg = args.find((value) => value.startsWith("--write="));

const python = process.env.PYTHON ?? "python3";
const childEnv = {
  ...process.env,
  ADK_TARGET_DIR: targetDir,
  PYTHONDONTWRITEBYTECODE: "1",
};

// Tracebacks name interpreter-internal files, and on a pyenv or Homebrew install those live
// under the reader's home directory. Without normalizing them, a clean run on someone else's
// machine would trip the local-path check below — a red that says nothing about the target.
function interpreterPrefixes() {
  const probe = spawnSync(
    python,
    [
      "-c",
      "import sys, sysconfig; print(sys.prefix); print(sys.base_prefix); print(sysconfig.get_paths()['stdlib']); print(sysconfig.get_paths()['purelib'])",
    ],
    { encoding: "utf8" },
  );
  if (probe.status !== 0) {
    console.error(`cannot resolve interpreter paths with ${python}`);
    process.exit(1);
  }
  return [...new Set(probe.stdout.split("\n").map((line) => line.trim()))]
    .filter((value) => value.length > 1 && path.isAbsolute(value))
    .sort((a, b) => b.length - a.length);
}

const pythonPrefixes = interpreterPrefixes();

function sanitize(text) {
  let out = text.replaceAll(targetDir, "<target>").replaceAll(root, "<repo>");
  for (const prefix of pythonPrefixes) out = out.replaceAll(prefix, "<python>");
  return out;
}

function runPython(scriptName) {
  const result = spawnSync(python, [path.join(root, "harness", scriptName)], {
    cwd: root,
    encoding: "utf8",
    env: childEnv,
  });
  if (result.error) {
    console.error(`failed to start ${python}: ${result.error.message}`);
    process.exit(1);
  }
  return {
    status: result.status,
    signal: result.signal,
    text: sanitize(`${result.stdout}${result.stderr}`),
  };
}

const stale = runPython("run_stale_main.py");
if (stale.signal) {
  console.error(`stale-agent run terminated by signal ${stale.signal}`);
  process.exit(1);
}

const lines = [];
lines.push(`MODE=${mode}`);
lines.push(stale.text.trimEnd());
lines.push(`STALE_MAIN_EXIT_CODE=${stale.status}`);

// The sibling shape check is a baseline-only observation: the patch under test touches
// `adk_stale_agent/main.py` only, so re-running it in patched mode would report the same
// frozen behavior and invite the reader to think the patch had been evaluated there.
if (mode === "baseline") {
  const sibling = runPython("check_sibling_shape.py");
  lines.push(sibling.text.trimEnd());
  lines.push(`SIBLING_CHECK_EXIT_CODE=${sibling.status}`);
}

const errorLines =
  stale.text.match(/ERROR Error processing issue #(?:101|202|303):/g) ?? [];

const checks =
  mode === "baseline"
    ? [
        ["three injected stale-agent failures", errorLines.length === 3],
        [
          "batch reports all three as processed",
          stale.text.includes("Successfully processed 3 issues."),
        ],
        [
          "no failure list in the summary",
          !stale.text.includes("Failed to process"),
        ],
        ["frozen entry point exits 0", stale.status === 0],
        [
          "sibling returns its normal metrics tuple after an error",
          lines.some((line) =>
            line.includes("SIBLING_RETURNED_AFTER_ERROR=true"),
          ),
        ],
      ]
    : [
        ["three injected stale-agent failures", errorLines.length === 3],
        [
          "batch reports zero successes",
          stale.text.includes("Successfully processed 0 issues."),
        ],
        [
          "batch lists the failed issues",
          /Failed to process 3 issues: \[101, 202, 303\]/.test(stale.text),
        ],
        [
          "no false success summary",
          !stale.text.includes("Successfully processed 3 issues."),
        ],
        ["patched entry point exits non-zero", stale.status !== 0],
      ];

// A sanitizer that stops working must not pass silently: a local absolute path in the
// recorded output is a release-blocking leak, not a cosmetic problem.
checks.push([
  "output carries no local home path",
  !lines.join("\n").includes(["/", "Users", "/"].join("")),
]);

for (const [name, passed] of checks) {
  lines.push(`${passed ? "PASS" : "FAIL"} ${name}`);
}

const output = `${lines.join("\n")}\n`;
process.stdout.write(output);

if (writeArg) {
  const destination = path.resolve(root, writeArg.slice("--write=".length));
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, output);
  console.log(`recorded evidence: ${path.relative(root, destination)}`);
}

if (checks.some(([, passed]) => !passed)) process.exit(1);
