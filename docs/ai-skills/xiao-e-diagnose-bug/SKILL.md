---
name: xiao-e-diagnose-bug
description: Diagnose Xiao-E Peilian bugs with a reproduce-hypothesize-instrument-fix-verify loop. Use when behavior is wrong, screenshots disagree with UI, cloud functions fail, pose recognition is unstable, voice/TTS/ASR is broken, video playback fails, data binding is inconsistent, or the user is frustrated that a previous fix did not work.
---

# Xiao-E Bug Diagnosis

Use this skill when guessing would waste time.

## Workflow

1. Reproduce or reconstruct the symptom from screenshot, logs, code path, or user steps.
2. Identify the exact user-facing failure.
3. Build 3 to 5 falsifiable hypotheses.
4. Inspect the smallest relevant files first.
5. Add temporary diagnostics only if logs are insufficient, and remove or hide noisy logs before finishing.
6. Fix the root cause, not only the visible text.
7. Verify with a targeted check.
8. Summarize cause, fix, and residual risk.

## RTK Defaults

Use RTK for broad output:

- `rtk git status`
- `rtk diff`
- `rtk grep "keyword" miniprogram cloudfunctions`
- `rtk read path/to/file`

Read full files directly before editing.

If logs are very long, prefer `rtk err`, `rtk log`, `rtk grep`, or `rtk read` before asking the user to paste raw output.

## Common Xiao-E Failure Classes

- Encoding or stale text residue from older files.
- Page data source and visual state disagree.
- WeChat subpackage asset paths differ from main package paths.
- Cloud function fallback hides the real upstream error.
- Pose service receives keypoints with low confidence or wrong action key.
- Caregiver binding state is local but cloud relation is missing, or the reverse.
- TTS URL is not playable by mini-program unless bridged through cloud storage.
- Video files exceed package limits or need local copy before playback.

## Verification

Choose the lightest useful check:

- Search old text no longer exists.
- Validate JSON/WXML/WXSS syntax where possible.
- Run cloud function test only when environment is available.
- Ask for WeChat DevTools screenshot only when visual verification requires it.

Do not finish with "should work" when a concrete verification is available.
