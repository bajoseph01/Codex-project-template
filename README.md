# Codex Project Template (Mr Jo)

This is a lightweight **starter repo** designed for long-term projects with ChatGPT/Codex.

## Quick start (5 minutes)

1) **Duplicate this template** (GitHub "Use this template") or copy the folder locally.
2) Open the folder in **VS Code**.
3) Edit:
   - `PROJECT.md` (goal + success criteria)
   - `TASKS.md` (your first 3 tasks)
   - `HANDOFF.md` (your current baton pass)

## How you work with Codex (simple loop)

- Keep these as your **source of truth**:
  - `PROJECT.md`, `DECISIONS.md`, `TASKS.md`, `RUNBOOK.md`, `HANDOFF.md`
- Start each new chat by pasting:
  1) `CODEX_SYSTEM.md` (rules)
  2) `HANDOFF.md` (current state)
  3) Any relevant snippet from `CONTEXT_PACK.md`

## Suggested workflow

- Architect first -> lock decisions in `DECISIONS.md`
- Build in small patches -> update `HANDOFF.md` every session
- Keep run commands accurate in `RUNBOOK.md`

## What these files are (plain language)
- `PROJECT.md`: The big-picture goal and what success looks like.
- `DECISIONS.md`: Important choices you made and why.
- `TASKS.md`: Your to-do list (what to do now, next, later).
- `RUNBOOK.md`: Step-by-step setup, run, test, and deploy instructions.
- `HANDOFF.md`: A simple “where we are now” note for the next session.
- `CONTEXT_PACK.md`: Extra details (like errors, environment, or logs) you can paste into a chat when needed.

## What is an ADR?
An ADR is an "Architecture Decision Record" - a short note that captures a key choice you made and why, so you can remember it later.
Use `docs/adr/ADR_TEMPLATE.md` when you make an important decision that might be questioned or changed later.

---

**Timezone note:** Africa/Johannesburg
