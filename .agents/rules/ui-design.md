---
trigger: model_decision
description: Use for UI/UX design, frontend screen design or review, design system, visual styling, accessibility, or layout work. Not for backend-only tasks.
---

# UI design rules

Source of truth: `DESIGN.md`. Read it before design work; do not copy its details here.

- Values marked `UNDECIDED` are unapproved. Propose options; never pick or hard-code them.
- Do not create mockups, pages, or visual changes unless asked.
- Slop gate: for any non-trivial visual element, state why it is needed and the simpler alternative (`DESIGN.md` section 11). No rationale means drop or simplify.
- References: analyze and re-interpret, never copy. Log in `docs/design/REFERENCE_LOG.md`.
- Assets (icons, fonts, images, illustrations, animation, code): each needs a row in `docs/design/ASSET_LICENSES.md`. Unknown license means not approved.
- Review with `docs/design/DESIGN_QA.md`. Report which checks were actually run and which were judged by hand. Never claim a pass without running it.
- On conflict, `AGENTS.md`, security, and Git rules win. Report the conflict.
