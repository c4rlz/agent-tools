#!/usr/bin/env node
// Claude Code PreToolUse hook: blocks Bash commands that throw away work that
// can't be recovered, such as `git reset --hard`, `git clean -f`, discarding
// local changes, force-pushing, and `rm -r` outside the project.

import { execFileSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Splits a shell command into simple commands on ; && || | and newlines,
// then into words, honouring single quotes, double quotes and backslashes.
// (Same tokenizer as protect-main; each plugin ships on its own.)
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

const WRAPPERS = ["command", "sudo", "env", "exec", "nohup", "time"];
const GIT_OPTS_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--config-env"]);

// Drops env assignments and wrappers: FOO=1 sudo rm -rf x -> rm -rf x
function stripWrappers(words) {
  let i = 0;
  while (i < words.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i]) || WRAPPERS.includes(words[i]))) i++;
  return words.slice(i);
}

// Short flags can be bundled: -fdx contains f, d and x.
function hasFlag(args, short, long = []) {
  return args.some((a) => long.includes(a) || (short && /^-[a-zA-Z]+$/.test(a) && a.includes(short)));
}

// Returns why a git command would lose work, or null.
export function checkGit(words) {
  let i = 1;
  while (i < words.length && words[i].startsWith("-")) {
    if (GIT_OPTS_WITH_VALUE.has(words[i])) i++;
    i++;
  }
  const sub = words[i];
  const args = words.slice(i + 1);

  switch (sub) {
    case "reset":
      if (args.includes("--hard")) {
        return "`git reset --hard` throws away uncommitted changes for good. Commit or `git stash` them first, or ask the user to run it.";
      }
      return null;
    case "clean":
      if (hasFlag(args, "n", ["--dry-run"])) return null;
      if (hasFlag(args, "f", ["--force"])) {
        return "`git clean -f` deletes untracked files for good, which can include .env files and other local-only work. Preview with `git clean -n`, or ask the user to run it.";
      }
      return null;
    case "checkout": {
      const dash = args.indexOf("--");
      if (hasFlag(args, "f", ["--force"]) || dash !== -1 || args.includes(".")) {
        return "This `git checkout` discards uncommitted changes. Commit or `git stash` them first, or ask the user to run it.";
      }
      return null;
    }
    case "restore":
      if (args.includes("--staged") && !args.includes("--worktree") && !args.includes("-W")) return null;
      if (args.some((a) => !a.startsWith("-"))) {
        return "`git restore` discards uncommitted changes to these files. Commit or `git stash` them first, or ask the user to run it.";
      }
      return null;
    case "switch":
      if (hasFlag(args, "f", ["--force", "--discard-changes"])) {
        return "This `git switch` discards uncommitted changes. Commit or `git stash` them first, or ask the user to run it.";
      }
      return null;
    case "stash":
      if (args[0] === "drop" || args[0] === "clear") {
        return `\`git stash ${args[0]}\` deletes stashed work for good. Ask the user before dropping stashes.`;
      }
      return null;
    case "branch":
      if (args.includes("-D") || (hasFlag(args, "d", ["--delete"]) && hasFlag(args, "f", ["--force"]))) {
        return "`git branch -D` deletes a branch even if its commits aren't merged anywhere. Use `git branch -d`, which refuses unmerged branches, or ask the user.";
      }
      return null;
    case "push":
      // --force-with-lease and --force-if-includes are the safe forms.
      if (hasFlag(args, "f", ["--force"])) {
        return "`git push --force` can overwrite commits other people pushed. Use `git push --force-with-lease`, which refuses if the remote moved.";
      }
      if (args.some((a) => /^\+[^+]/.test(a))) {
        return "A `+` refspec force-pushes and can overwrite commits on the remote. Use `git push --force-with-lease` instead.";
      }
      return null;
    default:
      return null;
  }
}

function projectRoot(dir) {
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return dir;
  }
}

function isInside(root, target) {
  const rel = relative(root, target);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

// Returns why an rm command could delete something it shouldn't, or null.
export function checkRm(words, dir, root) {
  const args = words.slice(1);
  const recursive = hasFlag(args, "r", ["--recursive"]) || hasFlag(args, "R");
  if (!recursive) return null;
  if (root === homedir() || root === "/") {
    return "Recursive deletes are only allowed inside a project, and this isn't one. Ask the user to run it.";
  }

  const dashdash = args.indexOf("--");
  const targets = args.filter((a, i) => (dashdash !== -1 && i > dashdash) || (!a.startsWith("-") && (dashdash === -1 || i < dashdash)));
  for (const target of targets) {
    if (/[$`]/.test(target)) {
      return `\`rm -r ${target}\` uses a variable, so it can't be checked; if the variable is empty it can delete far more than intended. Use a literal path inside the project.`;
    }
    const expanded = target.replace(/^~(?=$|\/)/, homedir());
    const path = resolve(dir, expanded);
    if (isInside(tmpdir(), path)) continue;
    if (/[*?[]/.test(target) && !isInside(root, resolve(dir, dirname(expanded)))) {
      return `\`rm -r ${target}\` matches everything at the top of the project or outside it. Delete specific folders instead, or ask the user.`;
    }
    if (!isInside(root, path)) {
      return `\`rm -r ${target}\` would delete something outside the project (${root}). protect-destructive only allows recursive deletes inside the project; ask the user to run it.`;
    }
  }
  return null;
}

// Returns the reason to block a Bash command, or null to let it run.
export function check(command, cwd, rootFor = projectRoot) {
  if (!/\b(git|rm)\b/.test(command)) return null;
  let dir = cwd;

  for (const raw of splitCommands(command)) {
    if (raw[0] === "cd") {
      dir = resolve(dir, (raw[1] ?? homedir()).replace(/^~(?=$|\/)/, homedir()));
      continue;
    }
    const c = raw.indexOf("-c");
    if (/(^|\/)(ba|z|da)?sh$/.test(raw[0]) && c !== -1 && raw[c + 1]) {
      const inner = check(raw[c + 1], dir, rootFor);
      if (inner) return inner;
      continue;
    }
    const words = stripWrappers(raw);
    let reason = null;
    if (/(^|\/)git$/.test(words[0] ?? "")) reason = checkGit(words);
    else if (/(^|\/)rm$/.test(words[0] ?? "")) reason = checkRm(words, dir, rootFor(dir));
    if (reason) return `${reason} (blocked by protect-destructive)`;
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
