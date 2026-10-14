# agent-tools

Guardrails and tools for coding agents. Each tool is a [Claude Code](https://claude.com/claude-code) plugin you can install on its own.

## Install

Add the marketplace once, then install the tools you want:

```
/plugin marketplace add c4rlz/agent-tools
/plugin install protect-main@agent-tools
```

From your shell, use `claude plugin marketplace add` and `claude plugin install` with the same arguments.

## Tools

| Tool | What it does | Install |
| --- | --- | --- |
| [protect-main](plugins/protect-main) | Blocks `git push` to `main` or `master`, so the agent pushes a branch and opens a pull request instead. | `/plugin install protect-main@agent-tools` |
| [protect-env](plugins/protect-env) | Blocks reading or changing `.env` files, which usually hold secrets. Templates like `.env.example` stay readable. | `/plugin install protect-env@agent-tools` |
| [protect-destructive](plugins/protect-destructive) | Blocks commands that throw away work for good: `git reset --hard`, `git clean -f`, discarding changes, force-pushes, and `rm -rf` outside the project. | `/plugin install protect-destructive@agent-tools` |

Tools are written for Claude Code today. Each one keeps its logic in a plain script with its own tests, so it can be adapted for other agents.

## Add a tool

1. Create `plugins/<name>/` with a `.claude-plugin/plugin.json` manifest, the tool's components (such as `hooks/hooks.json` and `scripts/`), a `README.md` and a `test/` folder.
2. Add an entry for it to [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) and a row to the table above.
3. Run `npm test` and `claude plugin validate .`.

## Development

Needs Node 22 or later.

```sh
npm test                       # every tool's tests
claude plugin validate .       # the marketplace and each plugin manifest
```

CI runs the tests on every push and pull request.

## License

MIT
