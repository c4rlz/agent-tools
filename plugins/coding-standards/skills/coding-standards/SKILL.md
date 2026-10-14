---
name: coding-standards
description: Language-agnostic coding best practices for readability, design, error handling, testing, security, performance and dependencies. Use whenever writing, changing, refactoring or fixing code in any language, before calling coding work done, and when asked about code quality or best practices.
---

# Coding standards

Follow the standards in [standards.md](standards.md) whenever you write or change code. Read it before your first code change in a task.

The project's own conventions always win: its linters, formatters, style guides, CLAUDE.md or AGENTS.md, and the patterns already in the code. These standards fill the gaps.

The points that matter most:

1. **Understand, then make the smallest change.** Read the surrounding code, match its conventions, and don't touch what the task doesn't need.
2. **Write for the next reader.** Clear names, small single-purpose functions, shallow nesting, comments that explain why, no dead code.
3. **Keep it simple.** No speculative abstractions or features; extract shared code on the third repetition.
4. **Handle errors honestly.** Validate at boundaries, never swallow errors, no silent fallbacks, cover edge cases.
5. **Prove it works.** Add or update tests for the behaviour you changed, and run the tests, type checker and linter before saying you're done.
6. **Keep it safe.** No hard-coded secrets, untrusted input is validated, queries are parameterised, sensitive data stays out of logs.

Before finishing, go through the "Before you finish" checklist at the end of standards.md. If you deliberately depart from a standard, say so and why.
