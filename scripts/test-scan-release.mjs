// Tamper probes for the sterile-release guard.
//
// The guard is the last thing standing between a working repository and a public one, so it
// is not trusted on its word: each probe breaks one thing on purpose in a throwaway
// repository and requires the scanner to go red. A probe that stopped detecting its own
// breakage would leave the guard printing PASS over a leak.
//
// The credential- and address-shaped fixtures below are assembled from fragments at runtime,
// so this file itself never contains one — the scanner scans this file too, and an exclusion
// for the test would be exactly the kind of hole the guard exists to prevent.
import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const sourceRoot = path.resolve(import.meta.dirname, "..");
const workRoot = path.join(sourceRoot, ".work");
mkdirSync(workRoot, { recursive: true });

const RELEASE_IDENTITY = ["release", "-", "scan", "@", "users.noreply.github.com"].join("");
const PERSONAL_IDENTITY = ["someone", "@", "example", ".", "com"].join("");
const HOME_PATH = ["/", "Users", "/", "someone", "/", "private.txt"].join("");
const SITE_URL = "https://kerem-turhan.github.io/roadto100k-site/";
const TOKEN = ["gh", "p", "_", "a".repeat(36)].join("");

const created = [];

function makeRepo() {
  const dir = mkdtempSync(path.join(workRoot, "release-scan-probe-"));
  created.push(dir);
  const run = (command, args) =>
    spawnSync(command, args, { cwd: dir, encoding: "utf8" });
  assert.equal(run("git", ["init", "-b", "main"]).status, 0);
  assert.equal(run("git", ["config", "user.name", "Release Scan Probe"]).status, 0);
  assert.equal(run("git", ["config", "user.email", RELEASE_IDENTITY]).status, 0);
  mkdirSync(path.join(dir, "scripts"));
  cpSync(
    path.join(sourceRoot, "scripts", "scan-release.mjs"),
    path.join(dir, "scripts", "scan-release.mjs"),
  );
  writeFileSync(path.join(dir, "safe.txt"), "public evidence\n");
  writeManifest(dir, ["release-manifest.json", "safe.txt", "scripts/scan-release.mjs"]);
  commit(dir, "chore: seed probe repository");
  return { dir, run };
}

function writeManifest(dir, files) {
  writeFileSync(
    path.join(dir, "release-manifest.json"),
    `${JSON.stringify({ policy: "allowlist", files }, null, 2)}\n`,
  );
}

function commit(dir, message) {
  const run = (command, args) =>
    spawnSync(command, args, { cwd: dir, encoding: "utf8" });
  assert.equal(run("git", ["add", "-A"]).status, 0);
  const result = run("git", ["commit", "-m", message]);
  assert.equal(result.status, 0, result.stderr);
}

function scan(dir) {
  return spawnSync("node", ["scripts/scan-release.mjs"], {
    cwd: dir,
    encoding: "utf8",
  });
}

// The reason a probe went red is worth reporting, but the assertion text can quote the very
// literal the guard exists to keep out of sight. Redact the probe's own fixtures first.
function describeRed(stderr) {
  const line =
    stderr.split("\n").find((text) => text.includes("AssertionError")) ?? "red";
  return [SITE_URL, HOME_PATH, PERSONAL_IDENTITY, TOKEN]
    .reduce((text, literal) => text.replaceAll(literal, "<redacted>"), line)
    .replace("AssertionError [ERR_ASSERTION]: ", "")
    .slice(0, 90);
}

const results = [];
function probe(name, { expect, setup }) {
  const repo = makeRepo();
  setup(repo);
  const result = scan(repo.dir);
  const red = result.status !== 0;
  const passed = expect === "red" ? red : !red;
  results.push([name, passed, red ? describeRed(result.stderr) : "clean"]);
  if (!passed) {
    console.error(`\n--- ${name} ---\n${result.stdout}\n${result.stderr}`);
  }
}

try {
  probe("clean repository is accepted", {
    expect: "green",
    setup: () => {},
  });

  probe("the next-step URL is ordinary content, not an exception", {
    expect: "green",
    setup: ({ dir }) => {
      writeFileSync(path.join(dir, "safe.txt"), `Start here: ${SITE_URL}\n`);
      commit(dir, "docs: add the next step");
    },
  });

  probe("absolute home path in a tracked file", {
    expect: "red",
    setup: ({ dir }) => {
      writeFileSync(path.join(dir, "safe.txt"), HOME_PATH);
      commit(dir, "docs: add a path");
    },
  });

  probe("personal email address in a tracked file", {
    expect: "red",
    setup: ({ dir }) => {
      writeFileSync(path.join(dir, "safe.txt"), `contact: ${PERSONAL_IDENTITY}\n`);
      commit(dir, "docs: add a contact");
    },
  });

  probe("credential committed and later deleted still fails on history", {
    expect: "red",
    setup: ({ dir }) => {
      writeFileSync(path.join(dir, "leak.txt"), `${TOKEN}\n`);
      writeManifest(dir, [
        "release-manifest.json",
        "leak.txt",
        "safe.txt",
        "scripts/scan-release.mjs",
      ]);
      commit(dir, "chore: add a file");
      rmSync(path.join(dir, "leak.txt"));
      writeManifest(dir, [
        "release-manifest.json",
        "safe.txt",
        "scripts/scan-release.mjs",
      ]);
      commit(dir, "chore: remove a file");
    },
  });

  probe("tracked file missing from the manifest", {
    expect: "red",
    setup: ({ dir }) => {
      writeFileSync(path.join(dir, "extra.txt"), "an unlisted file\n");
      commit(dir, "chore: add an unlisted file");
    },
  });

  probe("manifest lists a file that is not tracked", {
    expect: "red",
    setup: ({ dir }) => {
      writeManifest(dir, [
        "release-manifest.json",
        "safe.txt",
        "scripts/scan-release.mjs",
        "ghost.txt",
      ]);
      commit(dir, "chore: list a missing file");
    },
  });

  probe("commit identity that is not a GitHub noreply address", {
    expect: "red",
    setup: ({ dir, run }) => {
      assert.equal(run("git", ["config", "user.email", PERSONAL_IDENTITY]).status, 0);
      writeFileSync(path.join(dir, "safe.txt"), "another line\n");
      commit(dir, "chore: commit under a personal identity");
    },
  });

  probe("dirty worktree", {
    expect: "red",
    setup: ({ dir }) => {
      writeFileSync(path.join(dir, "safe.txt"), "uncommitted change\n");
    },
  });

  probe("private operations material under any path", {
    expect: "red",
    setup: ({ dir }) => {
      mkdirSync(path.join(dir, "notes"));
      writeFileSync(path.join(dir, "notes", "LEADS.md"), "a list\n");
      writeManifest(dir, [
        "release-manifest.json",
        "notes/LEADS.md",
        "safe.txt",
        "scripts/scan-release.mjs",
      ]);
      commit(dir, "chore: add notes");
    },
  });

  // A repository with nothing tracked must not be reported as a clean release.
  probe("repository with no tracked files", {
    expect: "red",
    setup: ({ dir, run }) => {
      assert.equal(run("git", ["rm", "-r", "-q", "--cached", "."]).status, 0);
      assert.equal(run("git", ["commit", "-q", "-m", "chore: untrack everything"]).status, 0);
    },
  });

  for (const [name, passed, detail] of results) {
    console.log(`${passed ? "PASS" : "FAIL"} ${name} (${detail})`);
  }
  const failed = results.filter(([, passed]) => !passed);
  assert.equal(failed.length, 0, `${failed.length} release-scan probes did not behave`);
  console.log(`release-scan probes: PASS (${results.length} probes)`);
} finally {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
}
