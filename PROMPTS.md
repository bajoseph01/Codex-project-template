# PROMPTS (library)

## P01 -- Builder Patch Loop
Use when: implementing a single task with minimal diffs.
Inputs: PROJECT.md, DECISIONS.md, TASKS.md, RUNBOOK.md, HANDOFF.md
Output contract:
- CODEWORD line
- patch plan
- exact edits
- commands + expected result
- updated HANDOFF.md

Example call:
Mode: BUILDER
Implement TASKS.md "Now #1".
