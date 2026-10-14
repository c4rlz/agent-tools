# protect-env

A [Claude Code](https://claude.com/claude-code) plugin that stops Claude from reading or changing `.env` files.

Env files usually hold API keys, tokens and passwords. When Claude tries to open one, the tool call is blocked before it runs, and Claude is told to ask you for what it needs instead. Templates such as `.env.example` stay readable, and your app still loads its env files as normal when it runs.

## Install

In Claude Code:

```
/plugin marketplace add c4rlz/agent-tools
/plugin install protect-env@agent-tools
```

Or from your shell:

```sh
claude plugin marketplace add c4rlz/agent-tools
claude plugin install protect-env@agent-tools
```

Needs Node 18 or later on your `PATH`.

## What it blocks

Env files are `.env`, `.env.<anything>` and `.envrc`, except templates ending in `.example`, `.sample`, `.template` or `.dist`.

| Action | Result |
| --- | --- |
| Read, Edit or Write on `.env.local` | Blocked |
| Grep inside `.env`, or with a `.env*` glob | Blocked |
| `cat .env.local`, `grep TOKEN .env`, `source .env`, `sed … .env.production` | Blocked |
| `node --env-file=.env.local …`, `echo KEY=1 >> .env`, `git add .env` | Blocked |
| Reading `.env.example` or `src/env.ts` | Allowed |
| `ls .env.local`, `test -f .env.local` | Allowed |
| `npm run dev`, even when the app loads `.env.local` itself | Allowed |

It also looks inside compound commands and `bash -c "..."`.

## Limits

This is a guardrail, not a security boundary. It checks the paths a tool call names, so it can't stop:

- a recursive search over a whole folder that happens to include an env file, such as `grep -r TOKEN .`
- a script or program that reads an env file and prints it

For stronger protection in Claude Code, also add `Read` deny rules for env files to your settings and turn on the [sandbox](https://code.claude.com/docs/en/sandboxing), which together stop shell commands reading them too:

```json
{
  "permissions": {
    "deny": ["Read(**/.env)", "Read(**/.env.local)", "Read(**/.env.*.local)"]
  },
  "sandbox": { "enabled": true }
}
```

## Development

From the repository root:

```sh
npm test                                   # tests for every tool
claude --plugin-dir ./plugins/protect-env  # try it in a session without installing
```

The hook is a single dependency-free script: [`scripts/protect-env.mjs`](scripts/protect-env.mjs).

## License

MIT, see [LICENSE](../../LICENSE).
