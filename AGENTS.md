# jobLog

Stack: Next.js (App Router) + TypeScript in `apps/web`, Python 3.12 worker in `services/ai`, Supabase/PostgreSQL in `supabase`. Keep this file under 200 lines.

## Commands
Run from the repository root. Same values as `docs/design/RUNBOOK.md` §2.

| Purpose | Command |
|---|---|
| Install | `npm run setup` (`setup:web`, `setup:ai`) |
| Run web | `npm run dev:web` |
| Run AI worker | `npm run dev:ai` |
| Test | `npm test` (`test:web`, `test:ai`, `test:db`) |
| Lint and types | `npm run lint` (`lint:web`, `lint:ai`) |
| DB migrations | `npm run db:migrate` (prints guidance only) |

## Communication
- Reply to the user in Korean. Write code, comments, commits, and docs in English.
- Lead with the result. No preamble, no recap of the request, no closing summary of what the diff already shows.

## Anti-slop (code quality)
- Do exactly what was asked. No unrequested features, refactors, files, or docs (no stray README/*.md).
- Read existing code first and match its patterns, naming, and libraries. Reuse before writing new helpers.
- Do not add a dependency for something the stdlib or an existing dependency does.
- No speculative abstraction: no wrapper, interface, config option, or factory with a single use.
- No dead code, commented-out code, unused imports, or placeholder TODOs.
- Comments explain why, never what. Do not narrate the code.
- No blanket try/catch, no swallowed errors, no invented fallbacks. Handle only errors that can occur; surface the rest.
- Do not invent APIs, flags, or package names. If unsure, check the source or docs, or say so.
- Never claim "done" or "fixed" without running the relevant test/lint/build. If it cannot be run, say so.
- Keep diffs minimal and scoped. Do not reformat or rename unrelated code.

## Token economy
- Search before reading: use Grep/Glob, then read only the needed line ranges. Do not read whole large files or re-read unchanged ones.
- Never read or print lockfiles, build output, `node_modules`, logs, or binaries unless the task is about them.
- Pipe noisy commands to a file or filter them; never dump full command output into context.
- Batch independent tool calls in parallel.
- Prefer a targeted edit over rewriting a file.
- Ask one concise question only when a wrong guess would be costly; otherwise choose a sensible default and state it.
- Do not add content that changes weekly to this file or to `.cursor/rules`.

## Security (non-negotiable)
- Never hardcode or log secrets, tokens, keys, passwords, or personal data. Read them from environment variables.
- Never read, print, or commit `.env*` (except `.env.example`), key files, or credentials.
- Validate and sanitize all external input; use parameterized queries; encode output.
- Do not run destructive commands (`rm -rf`, `git reset --hard`, force push, DB drops) without explicit user approval.
- Add dependencies only from well-known sources, with pinned versions and a committed lockfile. Flag anything suspicious.
- Details: `.cursor/rules/security.mdc`.

## GitHub readiness
- Commit only when asked. Never push, force-push, or rewrite history without explicit approval.
- Before any commit: confirm no secrets or personal data are staged and that `.gitignore` covers generated and local files.
- Details: `.cursor/rules/github-release.mdc`.

## Design
- For UI/UX design or review work, read `DESIGN.md` first. Values marked `UNDECIDED` are unapproved; never choose them without user approval.
