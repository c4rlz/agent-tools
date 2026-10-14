import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { check, splitCommands } from "../plugins/protect-main/scripts/protect-main.mjs";

const script = fileURLToPath(new URL("../plugins/protect-main/scripts/protect-main.mjs", import.meta.url));

// A repo stub: current branch and push destination, no real git needed.
const on = (branch, push = null) => () => (args) => {
  if (args[0] === "symbolic-ref") return branch;
  if (args[0] === "rev-parse") return push;
  return null;
};

const blocked = (cmd, repo = on("feature")) => assert.ok(check(cmd, "/repo", {}, repo), `should block: ${cmd}`);
const allowed = (cmd, repo = on("feature")) => assert.equal(check(cmd, "/repo", {}, repo), null, `should allow: ${cmd}`);

test("explicit pushes to main or master are blocked", () => {
  blocked("git push origin main");
  blocked("git push origin master");
  blocked("git push -u origin main");
  blocked("git push --force origin main");
  blocked("git push origin +main");
  blocked("git push origin feature:main");
  blocked("git push origin HEAD:refs/heads/main");
  blocked("git push origin --delete main");
  blocked("git push origin feature main");
});

test("pushes that touch every branch are blocked", () => {
  blocked("git push --all origin");
  blocked("git push --mirror origin");
});

test("bare pushes are blocked when they would go to main", () => {
  blocked("git push", on("main"));
  blocked("git push origin", on("main"));
  blocked("git push origin HEAD", on("main"));
  blocked("git push", on("feature", "origin/main")); // feature tracks main
  allowed("git push", on("feature", "origin/feature"));
  allowed("git push -u origin HEAD", on("feature"));
});

test("pushes to other branches and tags are allowed", () => {
  allowed("git push origin feature");
  allowed("git push origin main-redesign");
  allowed("git push origin v1.0.0");
  allowed("git push --tags", on("main"));
  allowed("git push origin main:feature");
});

test("non-push commands are allowed", () => {
  allowed("git status");
  allowed("git checkout main && git pull");
  allowed('git commit -m "push to main later"');
  allowed("echo git push origin main");
  allowed("npm run push");
});

test("compound commands and wrappers are checked", () => {
  blocked("npm test && git push origin main");
  blocked("git add . ; git commit -m wip ; git push origin main");
  blocked("git -C ../other push origin main");
  blocked("GIT_SSH_COMMAND=ssh git push origin main");
  blocked('bash -c "git push origin main"');
  blocked("git push origin main 2>&1 | tail -5");
  allowed("git push origin feature > /dev/null 2>&1");
});

test("the protected list can be changed", () => {
  const env = { PROTECT_MAIN_BRANCHES: "production, develop" };
  assert.ok(check("git push origin develop", "/repo", env, on("feature")));
  assert.equal(check("git push origin main", "/repo", env, on("feature")), null);
});

test("splitCommands honours quotes", () => {
  assert.deepEqual(splitCommands(`git commit -m "a; b" && git push`), [
    ["git", "commit", "-m", "a; b"],
    ["git", "push"],
  ]);
});

test("end to end: real repos and hook output", () => {
  const repo = mkdtempSync(join(tmpdir(), "protect-main-"));
  const run = (...args) => execFileSync("git", ["-C", repo, ...args], { stdio: "ignore" });
  run("init", "-q", "-b", "main");
  run("-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init");

  const hook = (command) =>
    spawnSync("node", [script], {
      input: JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd: repo }),
      encoding: "utf8",
    });

  const onMain = hook("git push");
  assert.equal(onMain.status, 0);
  const out = JSON.parse(onMain.stdout);
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /main/);

  run("checkout", "-q", "-b", "feature");
  const onFeature = hook("git push -u origin feature");
  assert.equal(onFeature.status, 0);
  assert.equal(onFeature.stdout, "");

  assert.equal(hook("ls -la").stdout, "");
});
