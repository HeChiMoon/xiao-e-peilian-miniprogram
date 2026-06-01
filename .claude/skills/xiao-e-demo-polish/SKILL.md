---
name: xiao-e-demo-polish
description: Polish Xiao-E Peilian for a presentable demo, including UI consistency, elderly-friendly interaction, screenshot-driven fixes, removing mock or fallback leakage, cleaning test data guidance, syncing docs, and preparing architecture or achievement summaries. Use for demo cleanup, documentation sync, UI polish, presentation preparation, or final demo readiness work.
---

# Xiao-E Demo Polish

Use this skill when the goal is a cleaner demo, not a new product expansion.

## Priorities

1. Elder path must feel smooth and safe.
2. Caregiver binding should look real and understandable.
3. Mock/admin/demo boundaries must be explicit.
4. User-facing errors should be friendly.
5. Docs must match code reality.
6. Do not overclaim medical or production readiness.

## UI Polish Rules

- Prefer one clear primary action per screen.
- Keep elderly-facing copy short.
- Use large buttons and avoid overlapping controls.
- Do not expose raw exception text to users.
- After success, show a brief encouraging state before navigation unless it is final completion.
- For final completion, avoid redundant next-level prompts.
- Keep UI polished and intentional, but optimize for elderly mini-program usability over decorative web-style effects.
- Avoid generic or flashy aesthetics that conflict with a calm rehabilitation demo.
- Make spacing, typography, button hierarchy, and state feedback consistent across elder and caregiver flows.

## Documentation Sync

When docs are touched, keep these aligned:

- `README.md`
- `PROJECT_STATUS.md`
- `PRD.md`
- `CLOUD_DATABASE_SETUP.md`
- `ALIYUN_BODY_POSTURE_SETUP.md`
- `ROLE_LOGIN_DATA_ISOLATION.md`

Use "to be collected" for metrics that are not measured.

## RTK Rule

Use RTK to compare docs and quickly inspect current project status:

- `rtk read PROJECT_STATUS.md`
- `rtk read README.md`
- `rtk read PRD.md`
- `rtk diff`
- `rtk grep "mock" .`

For final wording, read the exact target document directly before editing.

Before committing or pushing, verify with Windows Git in PowerShell:

- `git status --short`
- `git diff`
- `git log --oneline --decorate -3`
- `git rev-list --left-right --count origin/main...main`
- `git rev-list --left-right --count wechat/main...main`

Do not push when the workspace has unexplained changes. Push to both GitHub `origin/main` and WeChat Git `wechat/main` only after the check is clean.

## Demo Boundary Language

Use:

- "presentable demo"
- "training coaching and health education"
- "pose recognition is demoable but not medical-grade"
- "caregiver side has real binding and lightweight overview"
- "admin side remains mock display"

Avoid:

- "medical diagnosis"
- "realtime WebSocket pose correction is complete"
- "complete commercial backend"
- unverified latency, accuracy, or usage claims
