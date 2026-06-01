---
name: xiao-e-project-context
description: Load the current product, architecture, terminology, boundaries, and handoff facts for the Xiao-E Peilian WeChat mini-program. Use when working on D:\微信小程序, reviewing project status, syncing docs, onboarding another AI/developer, answering "项目现状/下一步/为什么这么做", or before any broad feature planning for this mini-program.
---

# Xiao-E Project Context

Use this skill to align on current project reality before planning or making broad changes.

## Required Workflow

1. Prefer RTK for project-wide reads:
   - `wsl -d Ubuntu-24.04 -- bash -lc 'cd /mnt/d/微信小程序 && rtk read PROJECT_STATUS.md'`
   - `wsl -d Ubuntu-24.04 -- bash -lc 'cd /mnt/d/微信小程序 && rtk read README.md'`
   - `wsl -d Ubuntu-24.04 -- bash -lc 'cd /mnt/d/微信小程序 && rtk git status'`
2. Read exact files directly when editing or when RTK is too summarized.
3. Treat `PROJECT_STATUS.md`, `README.md`, and `PRD.md` as the current source of truth, but verify against code before changing behavior.
4. Preserve dirty user changes. Do not revert unrelated modifications.
5. Say "unknown" or "待收集" for unverified metrics.

## RTK Rule

Use RTK for long or broad command output:

- Git status, diff, log, and history
- Keyword search across `miniprogram` and `cloudfunctions`
- Long docs such as `PROJECT_STATUS.md`, `README.md`, and `PRD.md`
- Build, test, or cloud-function logs

Do not rely only on RTK when precise edits, exact line context, or full file semantics are needed. Read original files directly before patching.

For final commit and push decisions, use Windows Git in PowerShell as the source of truth. WSL Git/RTK may report false modified files because of CRLF/LF differences on the D drive.

## Current Truth Set

- Product: WeChat mini-program demo for elderly knee rehabilitation coaching.
- Main project path: `D:\微信小程序`.
- WSL project path: `/mnt/d/微信小程序`.
- Cloud environment: `cloud1-7gh2sy5r1102b28c`.
- AppID in recent project config: `wxde26c0a5776ed40b`.
- Main roles: elder and caregiver. Admin is mock/display only.
- Main demo focus: elder-side training loop, real caregiver binding, CloudBase persistence, pose recognition, AI voice Q&A.
- Current pose actions: wall squat, seated straight leg raise, single leg stand.
- Supine straight leg raise is paused.
- Old 6-action training flow is retired from the active product.

## Data Boundaries

- Elder data is isolated by `ownerOpenId`.
- Caregiver binding uses `ownerOpenId` and `caregiverOpenId`.
- One WeChat account resumes its own role context.
- Current model assumes one elder profile per elder account.

## Active Cloud Functions

- `authService`
- `elderService`
- `trainingService`
- `assessmentService`
- `bindingService`
- `poseService`
- `voiceService`

## Active Collections

- `elders`
- `training_progress`
- `assessment_reports`
- `caregiver_bindings`
- `pose_detection_records`
- `action_standards`
- `tts_audio_cache`

## Important Boundaries

- Do not describe the app as a medical diagnosis system.
- Do not expand admin into a real backend unless explicitly requested.
- Do not revive old 6-action training without an explicit product decision.
- Do not claim WebSocket realtime pose correction is implemented.
- Do not claim all video playback is universally stable unless verified on target devices.

## Optional References

Read `references/current-map.md` when you need a compact map of pages, services, cloud functions, and demo boundaries.
