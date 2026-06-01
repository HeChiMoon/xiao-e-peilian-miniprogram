---
name: xiao-e-pose-ai
description: Work on Xiao-E Peilian pose recognition, training actions, camera detection UI, Aliyun BodyPosture integration, action standards, keypoint confidence handling, knee angle scoring, pose records, and daily training pass/fail logic. Use when changing wall squat, seated straight leg raise, single leg stand, poseService, pose camera page, or training recognition rules.
---

# Xiao-E Pose AI

Use this skill for posture recognition and daily training logic.

## Current Product Scope

Active actions:

- Wall squat
- Seated straight leg raise
- Single leg stand

Paused:

- Supine straight leg raise
- Old 6-action flow
- Realtime WebSocket video-frame correction

## Workflow

1. Confirm the action key and level id mapping before editing.
2. Inspect both frontend and cloud paths:
   - `miniprogram/pages/pose/camera.js`
   - `miniprogram/services/poseService.js`
   - `miniprogram/services/trainingVisionRules.js`
   - `cloudfunctions/poseService/index.js`
3. Keep camera interaction simple for elderly users:
   - manual capture on camera page
   - clear retry button on failure
   - no raw technical errors in UI
   - success feedback before auto advance
4. Treat low-confidence or missing keypoints as a normal product state, not a crash.
5. Save useful backend records for diagnosis, but show friendly messages to users.

## RTK Rule

Use RTK for broad search and status:

- `rtk grep "actionKey" miniprogram cloudfunctions`
- `rtk grep "legRaise" miniprogram cloudfunctions`
- `rtk diff`

Use direct reads for `poseService`, camera page, and training rule files before patching thresholds or user-facing messages.

## Scoring Principles

- Require enough usable keypoints for the selected action.
- Filter or downweight zero/low-confidence keypoints.
- Prefer action-specific messages over generic recognition-failure text.
- Do not demand impossible full-body framing when the action only needs lower-body points, but be honest when the upstream model needs more context.

## Demo Priority

For demo stability, favor:

- reliable pass/fail for the 3 active actions
- clear retry flow
- understandable advice
- clean history/detail records

over adding new actions or medical precision.
