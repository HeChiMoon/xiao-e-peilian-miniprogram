---
name: xiao-e-demo-polish
description: "Polish Xiao-E Peilian for a presentable demo: UI consistency, elderly-friendly interaction, screenshot-driven fixes, removing mock/fallback leakage, cleaning test data guidance, syncing PRD/README/PROJECT_STATUS/CLOUD docs, and preparing architecture or成果 summaries. Use for demo收尾, 文档同步, 项目状态整理, UI打磨, or 上台展示准备."
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
- For final completion, avoid redundant "next level" prompts.

## Documentation Sync

When docs are touched, keep these aligned:

- `README.md`
- `PROJECT_STATUS.md`
- `PRD.md`
- `CLOUD_DATABASE_SETUP.md`
- `ALIYUN_BODY_POSTURE_SETUP.md`
- `ROLE_LOGIN_DATA_ISOLATION.md`

Use "待收集" for metrics that are not measured.

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

- "可演示 Demo"
- "训练陪练和健康科普"
- "姿势识别可用但非医疗级判断"
- "子女端真实绑定与轻量概览"
- "管理员端 mock 展示"

Avoid:

- "医疗诊断"
- "实时 WebSocket 姿态纠错已完成"
- "完整商业化后台"
- unverified latency or accuracy claims
