---
name: xiao-e-prd-sync
description: Sync Xiao-E Peilian PRD, project status, README,成果表述, architecture notes, and scope boundaries with the real codebase. Use when rewriting PRD sections, summarizing current achievements, producing measurable indicators, updating handoff docs, or aligning docs after feature changes.
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
4. Mark unknown metrics as `待收集`.
5. Keep demo boundaries explicit.
6. Use concise, copy-paste-ready wording when the user asks for report text.

## RTK Rule

Use RTK for broad doc reads and comparisons:

- `rtk read PROJECT_STATUS.md`
- `rtk read README.md`
- `rtk read PRD.md`
- `rtk grep "关键词" .`
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

If the user provides official facts such as ICP备案 or上线状态, preserve them as user-provided unless asked to verify.

## Preferred Structure

For成果与指标:

- 关键指标
- 达成数据
- 成果描述
- 待收集项

For PRD updates:

- Product positioning
- Roles and flows
- Implemented features
- Data and cloud architecture
- AI capabilities
- Demo boundaries
- Future roadmap

## Boundary Language

Use:

- "可演示 Demo"
- "老人端主流程已跑通"
- "子女端真实绑定与轻量概览"
- "管理员端 mock 展示"
- "姿势识别可用但非医疗级判断"

Avoid:

- "完整商业化系统"
- "医疗诊断"
- "实时 WebSocket 姿态纠错已完成"
- unverified quantified claims

