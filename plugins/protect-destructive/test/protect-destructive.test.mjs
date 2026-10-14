import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "../scripts/protect-destructive.mjs";

const script = fileURLToPath(new URL("../scripts/protect-destructive.mjs", import.meta.url));
const root = "/work/project";
const rootFor = () => root;

const blocked = (cmd, cwd = root) => assert.ok(check(cmd, cwd, rootFor), `should block: ${cmd}`);
const allowed = (cmd, cwd = root) => assert.equal(check(cmd, cwd, rootFor), null, `should allow: ${cmd}`);

test("git commands that discard local work are blocked", () => {
  blocked("git reset --hard");
  blocked("git reset --hard HEAD~1");
  blocked("git clean -fd");
  blocked("git clean -fdx");
  blocked("git clean --force");
  blocked("git checkout -- src/index.ts");
  blocked("git checkout .");
  blocked("git checkout -f main");
  blocked("git restore src/index.ts");
  blocked("git restore .");
  blocked("git switch --discard-changes main");
  blocked("git stash drop");
  blocked("git stash clear");
  blocked("git branch -D old-feature");
});

test("safe git commands are allowed", () => {
  allowed("git reset");
  allowed("git reset --soft HEAD~1");
  allowed("git reset HEAD src/index.ts");
  allowed("git clean -n");
  allowed("git clean -nd");
  allowed("git checkout main");
  allowed("git checkout -b feature");
  allowed("git restore --staged src/index.ts");
  allowed("git switch -c feature");
  allowed("git stash");
  allowed("git stash pop");
  allowed("git branch -d merged-feature");
  allowed("git status && git diff");
});

test("force-pushes are blocked unless they use --force-with-lease", () => {
  blocked("git push --force origin feature");
  blocked("git push -f origin feature");
  blocked("git push -uf origin feature");
  blocked("git push origin +feature");
  allowed("git push --force-with-lease origin feature");
  allowed("git push --force-with-lease --force-if-includes origin feature");
  allowed("git push -u origin feature");
});

test("recursive deletes inside the project are allowed", () => {
  allowed("rm -rf node_modules");
  allowed("rm -rf dist build");
  allowed("rm -r ./coverage");
  allowed("rm -rf src/generated/*");
  allowed("cd packages/web && rm -rf .next");
  allowed(`rm -rf ${join(tmpdir(), "scratch")}`);
  allowed("rm file.txt");
  allowed("rm -f old.log");
});

test("recursive deletes outside the project are blocked", () => {
  blocked("rm -rf /");
  blocked("rm -rf ~");
  blocked("rm -rf ~/Documents");
  blocked("rm -rf ..");
  blocked("rm -rf ../other-project");
  blocked("rm -rf .");
  blocked("rm -rf *");
  blocked("rm -rf /usr/local/lib");
  blocked('rm -rf "$BUILD_DIR/"');
  blocked("sudo rm -rf /var/log");
  blocked("cd .. && rm -rf project");
  blocked("rm -rf node_modules", homedir());
});

test("compound commands and bash -c are checked", () => {
  blocked("npm test && git reset --hard");
  blocked('bash -c "git clean -fdx"');
  allowed("echo git reset --hard");
});

test("end to end: hook output", () => {
  const hook = (command) =>
    spawnSync("node", [script], {
      input: JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd: root }),
      encoding: "utf8",
    });

  const denied = hook("git reset --hard");
  assert.equal(denied.status, 0);
  const out = JSON.parse(denied.stdout);
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /stash/);

  assert.equal(hook("git status").stdout, "");
});
