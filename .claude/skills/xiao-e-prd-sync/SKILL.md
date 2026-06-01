---
name: xiao-e-prd-sync
description: Sync Xiao-E Peilian PRD, project status, README, achievement wording, architecture notes, and scope boundaries with the real codebase. Use when rewriting PRD sections, summarizing current achievements, producing measurable indicators, updating handoff docs, or aligning docs after feature changes.
---

# Xiao-E PRD Sync

Use this skill when documentation must match current project reality.

## Workflow

1. Load project context with `xiao-e-project-context`.
2. Inspect current docs:
   - `PRD.md`
   - `PROJECT_STATUS.md`
   - `README.md`
   - `CLOUD_DATABASE_SETUP.md`
   - `ALIYUN_BODY_POSTURE_SETUP.md`
   - `ROLE_LOGIN_DATA_ISOLATION.md`
3. Verify implementation facts against code before making claims.
4. Mark unknown metrics as "to be collected".
5. Keep demo boundaries explicit.
6. Use concise, copy-paste-ready wording when the user asks for report text.

## RTK Rule

Use RTK for broad doc reads and comparisons:

- `rtk read PROJECT_STATUS.md`
- `rtk read README.md`
- `rtk read PRD.md`
- `rtk grep "keyword" .`
- `rtk diff`

Use direct file reads before editing exact wording.

## Required Truthfulness

Do not invent:

- latency
- accuracy
- active users
- completed audits
- launch or approval facts
- medical-grade capability

If the user provides official facts such as ICP filing or launch status, preserve them as user-provided unless asked to verify.

## Preferred Structure

For achievements and metrics:

- key indicator
- achieved data
- result description
- items still to be collected

For PRD updates:

- product positioning
- roles and flows
- implemented features
- data and cloud architecture
- AI capabilities
- demo boundaries
- future roadmap

## Boundary Language

Use:

- "presentable demo"
- "elder-side main flow is runnable"
- "caregiver side has real binding and lightweight overview"
- "admin side is mock display"
- "pose recognition is demoable but not medical-grade"

Avoid:

- "complete commercial system"
- "medical diagnosis"
- "realtime WebSocket pose correction is complete"
- unverified quantified claims
