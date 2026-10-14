# coding-standards

A [Claude Code](https://claude.com/claude-code) plugin with language-agnostic coding best practices: readability, design, error handling, testing, security, performance, dependencies and commits.

It works two ways:

- **While Claude writes code.** The `coding-standards` skill loads automatically when Claude writes, changes or fixes code, and Claude checks its work against the standards before finishing.
- **When you ask for a review.** `/coding-standards:review` checks a change against the standards and reports findings ranked by severity, with `file:line`, why each matters and a suggested fix. It doesn't edit anything.

The project's own conventions always come first: its linters, formatters, style guides, CLAUDE.md or AGENTS.md, and the patterns already in the code. These standards fill the gaps.

## Install

In Claude Code:

```
/plugin marketplace add c4rlz/agent-tools
/plugin install coding-standards@agent-tools
```

Or from your shell:

```sh
claude plugin marketplace add c4rlz/agent-tools
claude plugin install coding-standards@agent-tools
```

## Use

Claude follows the standards on its own whenever it writes code. To review a change:

```
/coding-standards:review                 # current branch against the default branch, plus uncommitted changes
/coding-standards:review develop         # changes since branching from develop
/coding-standards:review abc123..HEAD    # a commit range
/coding-standards:review src/billing.ts  # specific files
```

## The standards

The full list is in [`skills/coding-standards/standards.md`](skills/coding-standards/standards.md):

1. Before writing: understand first, match existing conventions, make the smallest change, reuse
2. Readability: clear names, small functions, shallow nesting, no magic values, comments that explain why, no dead code
3. Design: simplicity, abstract on the third repetition, separation of concerns, pure functions, explicit dependencies
4. Correctness and errors: validate at boundaries, never swallow errors, fail clearly, edge cases, resource cleanup
5. Testing: test behaviour, a test for every bug fix, edge cases, fast and deterministic tests, run them before finishing
6. Security: no hard-coded secrets, untrusted input, parameterised queries, least privilege, nothing sensitive in logs
7. Performance: measure first, avoid obvious waste, the right data structure
8. Dependencies: standard library first, justify new ones, pin and update
9. Changes and pull requests: small and focused, refactors separate, messages explain why, docs updated

It ends with a "Before you finish" checklist.

## Customise

To use your own standards, fork this repo and edit `standards.md`. Both skills read it. To add rules for one project only, put them in that project's CLAUDE.md, which takes precedence.

## License

MIT, see [LICENSE](../../LICENSE).
