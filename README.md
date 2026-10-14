# protect-main

A [Claude Code](https://claude.com/claude-code) plugin that stops Claude from pushing to `main`.

When Claude runs a `git push` that would update `main` or `master`, the push is blocked before it runs and Claude is told to push a feature branch and open a pull request instead. Your own `git push` in a terminal is unaffected.

## Install

In Claude Code:

```
/plugin marketplace add c4rlz/protect-main
/plugin install protect-main@protect-main
```

Or from your shell:

```sh
claude plugin marketplace add c4rlz/protect-main
claude plugin install protect-main@protect-main
```

Needs Node 18 or later on your `PATH`.

## What it blocks

| Command | Result |
| --- | --- |
| `git push origin main`, `git push -u origin main`, `git push --force origin main` | Blocked |
| `git push origin feature:main`, `git push origin HEAD:refs/heads/main` | Blocked |
| `git push origin --delete main` | Blocked |
| `git push` or `git push origin` while on `main`, or on a branch whose push target is `main` | Blocked |
| `git push --all`, `git push --mirror` | Blocked |
| `git push origin feature`, `git push -u origin HEAD` on a feature branch | Allowed |
| `git push --tags`, `git push origin v1.0.0` | Allowed |

It also looks inside compound commands (`npm test && git push origin main`), `cd` and `git -C` directory changes, and `bash -c "..."`.

## Protect other branches

Set `PROTECT_MAIN_BRANCHES` to a comma-separated list before starting Claude Code. It replaces the default `main,master`:

```sh
export PROTECT_MAIN_BRANCHES="main,production,release"
```

To set it for Claude Code only, add it to the `env` block of `~/.claude/settings.json`.

## Limits

This is a guardrail against mistakes, not a security boundary. It reads the command Claude is about to run, so it can't see pushes hidden behind a git alias, a script file or a Makefile target. To make `main` truly protected, also turn on branch protection on your git host, such as a [GitHub branch protection rule](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

## Development

```sh
npm test                                  # unit and end-to-end tests
claude plugin validate .                  # check the marketplace and plugin manifests
claude --plugin-dir ./plugins/protect-main  # try it in a session without installing
```

The hook is a single dependency-free script: [`plugins/protect-main/scripts/protect-main.mjs`](plugins/protect-main/scripts/protect-main.mjs).

## License

MIT
