import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { check, isEnvFile } from "../scripts/protect-env.mjs";

const script = fileURLToPath(new URL("../scripts/protect-env.mjs", import.meta.url));

const blockedBash = (command) => assert.ok(check("Bash", { command }), `should block: ${command}`);
const allowedBash = (command) => assert.equal(check("Bash", { command }), null, `should allow: ${command}`);

test("isEnvFile spots env files and lets templates through", () => {
  for (const f of [".env", ".env.local", ".env.production", ".env.development.local", "app/.env", "/abs/path/.env.local", ".envrc", ".env*"]) {
    assert.ok(isEnvFile(f), f);
  }
  for (const f of [".env.example", ".env.sample", ".env.template", ".env.dist", "env.ts", "src/env.ts", ".environment", "dotenv.js", "README.md"]) {
    assert.ok(!isEnvFile(f), f);
  }
});

test("file tools are blocked on env files", () => {
  assert.ok(check("Read", { file_path: "/repo/.env.local" }));
  assert.ok(check("Edit", { file_path: "/repo/.env" }));
  assert.ok(check("Write", { file_path: "/repo/.env.production" }));
  assert.ok(check("Grep", { pattern: "KEY", path: "/repo/.env.local" }));
  assert.ok(check("Grep", { pattern: "KEY", glob: ".env*" }));
});

test("file tools are allowed on other files", () => {
  assert.equal(check("Read", { file_path: "/repo/.env.example" }), null);
  assert.equal(check("Read", { file_path: "/repo/src/env.ts" }), null);
  assert.equal(check("Write", { file_path: "/repo/.env.example" }), null);
  assert.equal(check("Grep", { pattern: "KEY", path: "/repo/src" }), null);
  assert.equal(check("Glob", { pattern: "**/.env*" }), null); // lists names only
});

test("Bash commands that read env files are blocked", () => {
  blockedBash("cat .env.local");
  blockedBash("sed 's/=.*/=x/' .env.local");
  blockedBash("grep TOKEN .env");
  blockedBash("source .env && npm start");
  blockedBash(". ./.env");
  blockedBash("head -5 app/.env.production");
  blockedBash("cat .env*");
  blockedBash("node --env-file=.env.local script.js");
  blockedBash("cp .env.example .env.local");
  blockedBash("echo KEY=1 >> .env");
  blockedBash('bash -c "cat .env"');
  blockedBash("cat .envrc");
  blockedBash("git add .env");
});

test("Bash commands that don't open env files are allowed", () => {
  allowedBash("cat .env.example");
  allowedBash("ls -la .env.local");
  allowedBash("test -f .env.local && echo present");
  allowedBash("npm run dev");
  allowedBash("cat src/env.ts");
  allowedBash("echo done");
});

test("end to end: hook output", () => {
  const hook = (tool_name, tool_input) =>
    spawnSync("node", [script], { input: JSON.stringify({ tool_name, tool_input }), encoding: "utf8" });

  const denied = hook("Read", { file_path: "/repo/.env.local" });
  assert.equal(denied.status, 0);
  const out = JSON.parse(denied.stdout);
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /\.env\.local/);

  assert.equal(hook("Read", { file_path: "/repo/README.md" }).stdout, "");
  assert.equal(hook("Bash", { command: "ls" }).stdout, "");
});
