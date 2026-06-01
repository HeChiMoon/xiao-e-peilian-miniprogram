---
name: xiao-e-cloudbase-dev
description: Develop Xiao-E Peilian WeChat CloudBase backend features across cloud functions, CloudDB collections, mini-program service wrappers, openid isolation, caregiver binding, assessment reports, training progress, elder profiles, and TTS/pose records. Use for backend development, database schema changes, cloud function debugging, or replacing mock data with real cloud data.
---

# Xiao-E CloudBase Development

Use this skill for backend or cloud-data changes.

## Guardrails

- Preserve `ownerOpenId` and `caregiverOpenId` isolation.
- Do not change local storage keys unless explicitly requested.
- Do not change `app.json` routes unless the task requires a new page.
- Keep caregiver/admin expansion scoped; caregiver is real binding + overview, admin is mock unless requested.
- Prefer compatible schema additions over destructive migrations.
- Document new collections, fields, indexes, and initialization steps.

## Workflow

1. Read relevant service wrapper in `miniprogram/services`.
2. Read matching cloud function in `cloudfunctions`.
3. Check `CLOUD_DATABASE_SETUP.md` before changing collections.
4. Keep cloud function return shape stable when possible.
5. Update frontend service wrapper before page code.
6. Add user-readable fallback messages; log technical details only in cloud function logs.
7. Update docs when schema or deployment changes.

## RTK Rule

Use RTK for broad inspection:

- `rtk grep "collectionName" cloudfunctions miniprogram`
- `rtk read CLOUD_DATABASE_SETUP.md`
- `rtk diff`
- `rtk git status`

Use direct reads for cloud function code before editing. Do not let compressed output hide schema or permission details.

## Active Backend Map

- Auth and role resume: `authService`
- Elder profile: `elderService` + `elders`
- Training progress: `trainingService` + `training_progress`
- Assessment: `assessmentService` + `assessment_reports`
- Caregiver binding: `bindingService` + `caregiver_bindings`
- Pose records: `poseService` + `pose_detection_records` + `action_standards`
- Voice cache: `voiceService` + `tts_audio_cache`

## Validation

- Cloud function syntax is valid.
- Frontend service handles `success=false` and missing fields.
- Empty cloud data does not crash pages.
- Same WeChat user resumes the intended role.
- Different openids do not see each other's elder records.
