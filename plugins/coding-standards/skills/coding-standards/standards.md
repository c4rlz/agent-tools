# Coding standards

Language-agnostic best practices for writing and reviewing code. **The project's own conventions come first**: its linters, formatters, style guides, CLAUDE.md or AGENTS.md, and the patterns already in the code all override anything here. Use these standards to fill the gaps.

## 1. Before writing

- **Understand before changing.** Read the code you're changing and the code that calls it. Find out why it is the way it is before deciding it's wrong.
- **Match what's there.** Follow the project's existing naming, structure, error handling and test style, even where you'd choose differently. Consistency beats personal preference.
- **Make the smallest change that solves the problem.** Don't refactor, rename or reformat code the task doesn't touch. Mention unrelated problems instead of fixing them in the same change.
- **Reuse before writing.** Look for an existing function, utility or library that already does the job.

## 2. Readability

- **Names say what things are and do.** `unpaidInvoices`, not `list2`; `sendReminder()`, not `handle()`. Booleans read as questions: `isActive`, `hasAccess`. Avoid abbreviations that aren't universal.
- **Functions do one thing.** If you need "and" to describe a function, split it. Keep them short enough to read without scrolling.
- **Keep nesting shallow.** Return early for edge cases and errors instead of wrapping the main path in `if` blocks.
- **No magic values.** Give meaningful numbers and strings a named constant: `MAX_RETRIES = 3`, not a bare `3`.
- **Comments explain why, not what.** The code says what it does. A comment earns its place by explaining a reason, a constraint, a workaround or a non-obvious decision. Delete comments that restate the code, and keep comments true when the code changes.
- **No dead code.** Delete unused functions, variables, imports, commented-out code and stale TODOs. Version control remembers them.
- **Let the formatter decide formatting.** Use the project's formatter and linter rather than formatting by hand.

## 3. Design

- **Keep it simple.** Write the simplest code that meets today's requirements. Don't build for hypothetical future needs.
- **Abstract on the third repetition, not the first.** Duplication is cheaper than the wrong abstraction. When the same logic appears three times, extract it.
- **Separate concerns.** Keep business logic apart from I/O, UI, frameworks and storage, so each can change and be tested on its own.
- **Prefer pure functions.** Functions that only use their inputs and return a result are easier to test and reason about. Push side effects to the edges.
- **Limit shared mutable state.** Avoid globals and hidden state. Pass dependencies in explicitly.
- **Make invalid states hard to represent.** Use types, enums and validation so bad data is rejected early rather than handled everywhere.
- **Keep interfaces small.** Expose only what callers need. Fewer parameters; group related ones.

## 4. Correctness and errors

- **Validate at the boundaries.** Check input where it enters the system: user input, API requests, files, environment, external services. Trust data inside the boundary.
- **Never swallow errors.** Handle an error, or let it propagate. An empty catch block, or logging and carrying on as if nothing happened, hides bugs.
- **Fail fast and clearly.** Error messages say what went wrong and, where possible, how to fix it. Include the values that matter, never secrets.
- **No silent fallbacks.** Don't quietly substitute a default when something unexpected happens. Make the failure visible.
- **Think about edge cases.** Empty, missing and null values; zero, negative and very large numbers; duplicates; time zones and dates; concurrency; partial failure; retries.
- **Clean up resources.** Close files, connections and handles, including on error paths.

## 5. Testing

- **Test behaviour, not implementation.** Tests check what the code does through its public interface, so refactoring doesn't break them.
- **Every bug fix gets a test** that fails without the fix.
- **Cover the edge cases** from section 4, not just the happy path.
- **Tests are fast, deterministic and independent.** No reliance on test order, real time, randomness or the network unless that's the point of the test.
- **Tests are readable.** One behaviour per test, with a name that says what it checks: arrange, act, assert.
- **Run the tests before calling work done.** Also run the type checker and linter if the project has them.

## 6. Security

- **Never hard-code secrets.** Keys, tokens and passwords come from the environment or a secret store, never source code, logs or commits.
- **Treat all external input as untrusted.** Validate, then encode output for its context (HTML, SQL, shell, URLs).
- **Use parameterised queries.** Never build SQL or shell commands by joining strings with user input.
- **Least privilege.** Ask for only the permissions, scopes and access the code needs.
- **Don't log sensitive data.** Keep secrets and personal information out of logs, error messages and analytics.
- **Use established libraries for security.** Don't write your own crypto, auth or session handling.

## 7. Performance

- **Measure before optimising.** Clear code first; optimise only what profiling shows is slow.
- **Avoid obvious waste.** No repeated work inside loops, N+1 queries, or loading everything when you need a page.
- **Pick the right data structure.** A set or map for lookups, not a list scanned each time.

## 8. Dependencies

- **Prefer the standard library** and what the project already uses.
- **Justify every new dependency.** Check it's maintained, widely used, appropriately licensed and worth its size. A few lines of your own code can beat a package.
- **Pin and update.** Use the lockfile, and keep dependencies current for security fixes.

## 9. Changes, commits and pull requests

- **Small, focused changes.** One logical change per commit and per pull request.
- **Keep refactoring separate from behaviour changes**, so each is easy to review.
- **Commit messages explain why.** A short summary line, then the reason for the change if it isn't obvious.
- **Update docs with the code.** README, comments, API docs and examples change in the same pull request as the behaviour they describe.

## Before you finish

- [ ] The change does what was asked, and nothing it wasn't asked to do
- [ ] It follows the project's existing conventions
- [ ] Names are clear, and there's no dead code, debug output or stale comments
- [ ] Errors are handled and edge cases covered
- [ ] Tests are added or updated, and they pass, along with the type checker and linter
- [ ] No secrets or sensitive data in code, logs or commits
- [ ] Docs are updated if behaviour changed
