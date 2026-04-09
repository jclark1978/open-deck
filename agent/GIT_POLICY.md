# Git & GitHub Policy

## Branching

Never work directly in `main`.

Use:
- feature/<name>
- bugfix/<name>
- refactor/<name>
- hotfix/<name>

---

## Commits

Format:
`type: short description`

Types:
- feat
- fix
- refactor
- docs
- chore

Rules:
- One logical change per commit
- No secrets
- No broken code (unless intentional and labeled)

---

## Pull Requests

All changes go through PRs.

Each PR must include:
- What changed
- Why it changed
- Any risks

---

## Merging

Preferred:
- Squash for small features
- Merge commits for larger work

---

## Cleanup

- Delete branches after merge
- No stale branches

---

## Hard Stops

Refuse:
- Direct pushes to main
- Committing credentials
- Skipping PR process
