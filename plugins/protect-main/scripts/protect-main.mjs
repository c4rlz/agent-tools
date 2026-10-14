#!/usr/bin/env node
// Claude Code PreToolUse hook: blocks Bash commands that would `git push` to a
// protected branch (main and master by default). Reads the hook input on stdin
// and prints a deny decision when a push would update a protected branch.

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function protectedBranches(env = process.env) {
  const list = (env.PROTECT_MAIN_BRANCHES ?? "main,master")
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
  return new Set(list);
}

// Splits a shell command into simple commands on ; && || | and newlines,
// then into words, honouring single quotes, double quotes and backslashes.
export function splitCommands(command) {
  const commands = [];
  let words = [];
  let word = "";
  let inWord = false;
  let quote = null;

  const endWord = () => {
    if (inWord) words.push(word);
    word = "";
    inWord = false;
  };
  const endCommand = () => {
    endWord();
    if (words.length) commands.push(words);
    words = [];
  };

  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === "\\" && quote === '"' && i + 1 < command.length) word += command[++i];
      else word += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      inWord = true;
    } else if (c === "\\" && i + 1 < command.length) {
      word += command[++i];
      inWord = true;
    } else if (c === ";" || c === "\n" || c === "|" || c === "&" || c === "(" || c === ")") {
      endCommand();
    } else if (/\s/.test(c)) {
      endWord();
    } else {
      word += c;
      inWord = true;
    }
  }
  endCommand();
  return commands;
}

// git options that take a separate value, before and after `push`.
const GIT_OPTS_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--config-env"]);
const PUSH_OPTS_WITH_VALUE = new Set(["--repo", "-o", "--push-option", "--receive-pack", "--exec"]);

// Returns where a simple command runs `git push` from and its arguments, or null.
export function parseGitPush(words, cwd) {
  let i = 0;
  // Skip env assignments and wrappers: FOO=1 command sudo env git ...
  while (i < words.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i]) || ["command", "sudo", "env", "exec", "nohup", "time"].includes(words[i]))) i++;
  if (!/(^|\/)git$/.test(words[i] ?? "")) return null;
  i++;

  let dir = cwd;
  while (i < words.length && words[i].startsWith("-")) {
    const opt = words[i];
    if (opt === "-C") dir = resolve(dir, words[++i] ?? ".");
    else if (opt.startsWith("--git-dir=") || opt.startsWith("--work-tree=")) {
      // Leave dir as is; git resolves these itself when we ask it below.
    } else if (GIT_OPTS_WITH_VALUE.has(opt)) i++;
    i++;
  }
  if (words[i] !== "push") return null;
  return { dir, args: words.slice(i + 1) };
}

function git(dir, args) {
  try {
    return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function branchName(ref) {
  return ref.replace(/^refs\/heads\//, "");
}

// Branches a `git push <args>` run in `dir` would update. `lookup` answers
// questions about the repository, so tests can stub it.
export function pushTargets(args, dir, lookup = (a) => git(dir, a)) {
  const positional = [];
  let all = false;
  let tagsOnly = false;
  let mirror = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") {
      positional.push(...args.slice(i + 1));
      break;
    }
    if (arg === "--all" || arg === "--branches") all = true;
    else if (arg === "--mirror") mirror = true;
    else if (arg === "--tags") tagsOnly = true;
    else if (PUSH_OPTS_WITH_VALUE.has(arg)) i++;
    else if (/^\d*[<>]/.test(arg)) {
      // Redirection such as `> log` or `2>/dev/null`: skip the target too.
      if (/^\d*[<>]+$/.test(arg)) i++;
    } else if (!arg.startsWith("-")) positional.push(arg);
  }

  if (all || mirror) return { everything: true, branches: [] };

  const [, ...refspecs] = positional;
  if (refspecs.length === 0) {
    if (tagsOnly) return { everything: false, branches: [] };
    if (lookup(["config", "push.default"]) === "matching") return { everything: true, branches: [] };
    // Where a bare push goes: the configured push branch, else the current branch.
    const push = lookup(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{push}"]);
    if (push) return { everything: false, branches: [push.replace(/^[^/]+\//, "")] };
    const current = lookup(["symbolic-ref", "--short", "-q", "HEAD"]);
    return { everything: false, branches: current ? [current] : [] };
  }

  const branches = refspecs.map((spec) => {
    const s = spec.replace(/^\+/, "");
    const colon = s.indexOf(":");
    if (colon !== -1) return branchName(s.slice(colon + 1));
    if (s === "HEAD" || s === "@") return lookup(["symbolic-ref", "--short", "-q", "HEAD"]) ?? s;
    return branchName(s);
  });
  return { everything: false, branches };
}

// Returns the reason to block a Bash command, or null to let it run.
export function check(command, cwd, env = process.env, lookupFor = (dir) => (a) => git(dir, a)) {
  if (!/\bgit\b/.test(command) || !/\bpush\b/.test(command)) return null;
  const protectedSet = protectedBranches(env);
  let dir = cwd;

  for (const words of splitCommands(command)) {
    if (words[0] === "cd") {
      dir = resolve(dir, words[1] ?? process.env.HOME ?? ".");
      continue;
    }
    // bash -c "git push origin main" and similar: check the inner command.
    const c = words.indexOf("-c");
    if (/(^|\/)(ba|z|da)?sh$/.test(words[0]) && c !== -1 && words[c + 1]) {
      const inner = check(words[c + 1], dir, env, lookupFor);
      if (inner) return inner;
      continue;
    }
    const push = parseGitPush(words, dir);
    if (!push) continue;
    const { everything, branches } = pushTargets(push.args, push.dir, lookupFor(push.dir));
    const names = [...protectedSet].join(" or ");
    if (everything) return `This push could update ${names}. protect-main blocks pushes to ${names}; push a feature branch and open a pull request instead.`;
    const hit = branches.find((b) => protectedSet.has(b));
    if (hit) return `Pushing to ${hit} is blocked by protect-main. Push to a feature branch and open a pull request instead.`;
  }
  return null;
}

async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    return; // Not hook input; let the tool call proceed.
  }
  const command = payload?.tool_input?.command;
  if (payload?.tool_name !== "Bash" || typeof command !== "string") return;

  const reason = check(command, payload.cwd ?? process.cwd());
  if (reason) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: reason,
        },
      }),
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
