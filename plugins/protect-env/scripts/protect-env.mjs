#!/usr/bin/env node
// Claude Code PreToolUse hook: stops the agent reading or changing .env files,
// which usually hold secrets. Covers the Read, Edit, Write and Grep tools, and
// Bash commands that name an env file (cat .env, source .env.local, ...).

import { basename } from "node:path";
import { pathToFileURL } from "node:url";

// Templates that are meant to be shared and hold no secrets.
const SAFE_SUFFIXES = [".example", ".sample", ".template", ".dist"];

// Commands that only check an env file exists, without reading it.
const SAFE_COMMANDS = new Set(["ls", "test", "[", "touch"]);

export function isEnvFile(path) {
  const name = basename(String(path).replace(/\/+$/, ""));
  if (name === ".envrc") return true;
  if (!/^\.env(\..*|\*.*)?$/.test(name)) return false;
  return !SAFE_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

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

// The paths a word could name: itself, a redirection target (>.env) or an
// option value (--env-file=.env.local).
function candidates(word) {
  const unredirected = word.replace(/^\d*[<>]+&?/, "");
  const afterEquals = unredirected.includes("=") ? unredirected.slice(unredirected.lastIndexOf("=") + 1) : null;
  return [unredirected, afterEquals].filter(Boolean);
}

// Returns the env file a Bash command names, or null.
export function envFileInCommand(command) {
  if (!/\.env/.test(command)) return null;
  for (const words of splitCommands(command)) {
    const c = words.indexOf("-c");
    if (/(^|\/)(ba|z|da)?sh$/.test(words[0]) && c !== -1 && words[c + 1]) {
      const inner = envFileInCommand(words[c + 1]);
      if (inner) return inner;
      continue;
    }
    if (SAFE_COMMANDS.has(words[0])) continue;
    for (const word of words) {
      const hit = candidates(word).find(isEnvFile);
      if (hit) return hit;
    }
  }
  return null;
}

// Returns the reason to block a tool call, or null to let it run.
export function check(toolName, input = {}) {
  let file = null;
  switch (toolName) {
    case "Read":
    case "Edit":
    case "Write":
      file = isEnvFile(input.file_path ?? "") ? input.file_path : null;
      break;
    case "Grep":
      if (input.path && isEnvFile(input.path)) file = input.path;
      else if (input.glob && isEnvFile(input.glob)) file = input.glob;
      break;
    case "Bash":
      file = typeof input.command === "string" ? envFileInCommand(input.command) : null;
      break;
  }
  if (!file) return null;
  return `${basename(file)} is an env file, which usually holds secrets, so protect-env blocks agents from opening it. Ask the user to check the value or run this themselves. Templates such as .env.example are allowed.`;
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
  const reason = check(payload?.tool_name, payload?.tool_input);
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
