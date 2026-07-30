import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const targetDir = path.join(root, ".work", "upstream");
const freeze = JSON.parse(
  readFileSync(path.join(root, "research", "target-freeze.json"), "utf8"),
);

function run(args, cwd = root) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const probe = spawnSync("git", ["-C", targetDir, "rev-parse", "HEAD"], {
  encoding: "utf8",
});
if (probe.status !== 0) {
  run([
    "git",
    "clone",
    "--filter=blob:none",
    "--no-checkout",
    freeze.repositoryUrl,
    targetDir,
  ]);
}

run(["git", "-C", targetDir, "fetch", "origin", freeze.commitSha]);
run(["git", "-C", targetDir, "checkout", "--detach", freeze.commitSha]);

const head = spawnSync("git", ["-C", targetDir, "rev-parse", "HEAD"], {
  encoding: "utf8",
});
if (head.status !== 0 || head.stdout.trim() !== freeze.commitSha) {
  throw new Error("target checkout does not match the frozen SHA");
}
console.log(`target freeze: ${freeze.commitSha}`);
