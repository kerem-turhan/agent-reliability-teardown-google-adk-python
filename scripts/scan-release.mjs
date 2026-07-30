// Sterile-release guard. Every tracked file and the whole Git history are checked for local
// paths, credentials and personal addresses, and the tracked set must equal the release
// manifest exactly. See the scope note further down for what this guard does not cover.
//
// This is the last step of `npm run verify`, so its final lines are also where a reader who
// just ran the harness is told what to do next.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);
// An empty file list would make every assertion below vacuous and still print PASS.
assert.ok(tracked.length > 0, 'no tracked files to scan');

// Private-operations material must never be tracked here, under any path.
const forbiddenBasenames = [
  'OFFER.md',
  'OUTREACH-TEMPLATES.md',
  'PAYMENT-LEGAL.md',
  'LEADS.md',
  'STATUS.md',
  'UPSTREAM-ISSUE-DRAFT.md',
  'lead-list.md',
  'pipeline.md',
  'outreach-drafts.md',
];
for (const file of tracked) {
  const base = file.split('/').pop();
  assert.ok(!forbiddenBasenames.includes(base), `${file} is private operations material`);
}
assert.ok(
  !tracked.some((file) => /(^|\/)(?:\.work|node_modules|dist|coverage)(\/|$)/.test(file)),
  'a working, dependency or build directory is tracked',
);

// Tracked files must exactly equal the release-manifest allowlist (no drift in either
// direction). Without this, a newly committed file ships as long as its content is clean.
const manifest = JSON.parse(readFileSync('release-manifest.json', 'utf8'));
assert.equal(manifest.policy, 'allowlist');
const allowed = new Set(manifest.files);
const trackedSet = new Set(tracked);
for (const file of tracked) {
  assert.ok(allowed.has(file), `tracked file missing from release-manifest.json: ${file}`);
}
for (const file of allowed) {
  assert.ok(trackedSet.has(file), `release-manifest.json lists untracked file: ${file}`);
}

const patterns = [
  { name: 'absolute macOS home path', regex: /\/Users\/[A-Za-z0-9._-]+\// },
  { name: 'GitHub token', regex: /gh[opsu]_[A-Za-z0-9_]{20,}/ },
  { name: 'API key', regex: /sk-[A-Za-z0-9_-]{16,}/ },
  { name: 'private key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'email address', regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
];

const NEXT_STEP =
  'Want the same failure-focused teardown for your own agent? Start here: ' +
  'https://kerem-turhan.github.io/roadto100k-site/';

// Scope, so nobody mistakes this for more than it is: the patterns above are the shapes that
// can be recognized without knowing anything private. Screening the release against a list of
// specific names is a separate step that runs before publication, from a term list held
// outside this repository. Carrying such a list here — even obfuscated — would publish the
// very strings it exists to keep out, so it is deliberately absent and this guard makes no
// claim to cover it.
for (const file of tracked) {
  const content = readFileSync(file, 'utf8');
  for (const pattern of patterns) {
    assert.ok(!pattern.regex.test(file), `${pattern.name} found in tracked path ${file}`);
    assert.ok(!pattern.regex.test(content), `${pattern.name} found in ${file}`);
  }
}

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });

// Git history is three surfaces, not one, and each needs its own policy.
//
// 1. Diffs. Every pattern applies, including the email pattern: an address committed and
//    later deleted would otherwise pass.
// 2. Commit and tag identities. `git log --format=` strips exactly the headers that carry
//    them, so they need their own pass. They are emails by construction, so an allowlist is
//    the right shape here: only GitHub noreply addresses may appear.
// 3. Message and ref text. Subjects, bodies, tag messages and ref names.
const diffHistory = git('log', '-p', '--all', '--format=');
for (const pattern of patterns) {
  assert.ok(!pattern.regex.test(diffHistory), `${pattern.name} found in Git history`);
}

const releaseIdentity = /^[A-Za-z0-9._+-]+@users\.noreply\.github\.com$/;
const identities = [
  ...git('log', '--all', '--format=%ae%n%ce').split('\n'),
  ...git('for-each-ref', '--format=%(taggeremail)').split('\n'),
]
  .map((line) => line.trim().replace(/^<|>$/g, ''))
  .filter(Boolean);
assert.ok(identities.length > 0, 'no commit identities to check');
for (const identity of new Set(identities)) {
  assert.ok(
    releaseIdentity.test(identity),
    `commit or tag identity ${identity} is not a GitHub noreply release identity`,
  );
}

const messageHistory =
  git('log', '--all', '--format=%an%n%cn%n%s%n%b') +
  git('for-each-ref', '--format=%(refname)%n%(contents)');
for (const pattern of patterns) {
  assert.ok(
    !pattern.regex.test(messageHistory),
    `${pattern.name} found in Git commit or tag metadata`,
  );
}

assert.equal(
  execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  '',
  'worktree is not clean',
);

console.log(`release-scan: PASS (${tracked.length} tracked files + Git history)`);
console.log('\nNext step');
console.log(NEXT_STEP);
