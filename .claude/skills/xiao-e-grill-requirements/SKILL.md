---
name: xiao-e-grill-requirements
description: Clarify and pressure-test Xiao-E Peilian mini-program feature requests before implementation. Use when the user asks for a new feature, backend phase, AI capability, UI overhaul, demo plan, PRD change, next-step plan, or continued development, especially when requirements could affect product scope, data model, cloud functions, role login, pose recognition, or demo boundaries.
---

# Xiao-E Requirements Grill

Use this skill before committing to ambiguous or high-impact development.

## Workflow

1. Load current context with `xiao-e-project-context` when broad scope is involved.
2. Inspect relevant code/docs before asking questions when the answer is discoverable.
3. Ask only decision-grade questions. Avoid making the user restate facts already in the repo.
4. Convert answers into a concrete plan with:
   - product scope
   - affected pages
   - affected services/cloud functions
   - data model impact
   - demo risk
   - validation plan
5. If the user confirms approval or asks to continue, implement the plan.

## RTK Rule

Use RTK to quickly inspect status, docs, and broad search results before asking the user to repeat context. Switch to direct file reads before proposing code-level changes.

## Question Checklist

Use only the questions that matter:

- Which role is affected: elder, caregiver, admin, or shared?
- Is this demo-only, or should data be persisted?
- Does it change existing CloudDB collections or storage keys?
- Does it affect identity, openid isolation, or binding relationships?
- Does it add routes or only change existing pages?
- Does it require real cloud/API behavior or a UI-only demo?
- What is the success signal for the demo?
- What should be delayed or explicitly not built?

## Planning Output

Keep plans practical:

- "Now" means code changes in this repo.
- "Later" means future planning docs or ADR.
- "Not doing" prevents scope creep.

Do not propose large rewrites unless the existing structure blocks the goal.
