---
name: review
description: Review code changes against the coding standards and report what to fix, ranked by severity.
argument-hint: "[base branch, commit range or files]"
disable-model-invocation: true
allowed-tools: Read Grep Glob Bash(git diff *) Bash(git log *) Bash(git status *) Bash(git merge-base *) Bash(git rev-parse *)
---

# Review against the coding standards

Review code changes against [the coding standards](${CLAUDE_PLUGIN_ROOT}/skills/coding-standards/standards.md). Read that file first. The project's own conventions (linters, style guides, CLAUDE.md or AGENTS.md, existing patterns) override it.

## What to review

Use `$ARGUMENTS` if given:

- a branch name: review the changes since this branch's merge base with it
- a commit range such as `abc123..HEAD`: review that range
- file paths: review those files in full

With no arguments, review the current branch against the repository's default branch (find it with `git rev-parse --abbrev-ref origin/HEAD`, falling back to `main`), plus any uncommitted changes from `git status`. If there's nothing to review, say so and stop.

## How to review

1. Read the diff, then open the changed files for enough surrounding context to judge each change. Look at how the code is used and tested.
2. Check each change against every section of the standards, plus the project's own conventions.
3. Keep only real problems you can point to. Skip anything a formatter or linter would fix automatically, and don't flag code the change didn't touch unless the change makes it worse.

## How to report

Start with one sentence on the overall state of the change. Then list findings, most severe first:

- **Must fix**: bugs, security problems, lost or swallowed errors, missing tests for changed behaviour
- **Should fix**: design, readability or maintainability problems that will cost later
- **Consider**: smaller improvements

For each finding give the `file:line`, what's wrong, why it matters (naming the standard), and a concrete fix. End with anything done notably well, in a line or two.

Don't edit any files. If the user then asks you to apply fixes, make only the changes they approve.
