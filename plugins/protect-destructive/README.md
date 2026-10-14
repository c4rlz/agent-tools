# protect-destructive

A [Claude Code](https://claude.com/claude-code) plugin that stops Claude from running commands that throw away work for good.

When Claude tries one, the command is blocked before it runs and Claude is told the safer alternative, such as `git stash` instead of `git reset --hard`. Your own commands in a terminal are unaffected.

## Install

In Claude Code:

```
/plugin marketplace add c4rlz/agent-tools
/plugin install protect-destructive@agent-tools
```

Or from your shell:

```sh
claude plugin marketplace add c4rlz/agent-tools
claude plugin install protect-destructive@agent-tools
```

Needs Node 22 or later on your `PATH`.

## What it blocks

| Command | Result | Instead |
| --- | --- | --- |
| `git reset --hard` | Blocked | Commit or `git stash` first |
| `git clean -f`, `-fd`, `-fdx` | Blocked | Preview with `git clean -n` |
| `git checkout -- <file>`, `git checkout .`, `git restore <file>`, `git switch --discard-changes` | Blocked | Commit or `git stash` first |
| `git stash drop`, `git stash clear` | Blocked | Ask first |
| `git branch -D` | Blocked | `git branch -d`, which refuses unmerged branches |
| `git push --force`, `git push -f`, `git push origin +branch` | Blocked | `git push --force-with-lease` |
| `rm -r` / `rm -rf` outside the project, on `.`, `*` at the project root, or on a path built from a variable | Blocked | Delete specific folders inside the project |
| `rm -rf node_modules`, `rm -rf dist`, `rm -rf` inside the temp folder | Allowed | |
| `git reset --soft`, `git restore --staged`, `git clean -n`, `git push --force-with-lease` | Allowed | |

The project is the git repository Claude is working in, or the current folder when there isn't one. Recursive deletes are blocked entirely when Claude is working from your home folder. It also looks inside compound commands, `cd` changes, `sudo` and `bash -c "..."`.

## Limits

This is a guardrail, not a security boundary. It reads the command Claude is about to run, so it can't see deletes inside scripts, Makefile targets or other programs. Commit often and keep a backup.

## Development

From the repository root:

```sh
npm test                                           # tests for every tool
claude --plugin-dir ./plugins/protect-destructive  # try it in a session without installing
```

The hook is a single dependency-free script: [`scripts/protect-destructive.mjs`](scripts/protect-destructive.mjs).

## License

MIT, see [LICENSE](../../LICENSE).
