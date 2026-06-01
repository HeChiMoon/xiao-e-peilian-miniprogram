# Current Map

## Frontend

Main package pages:

- `pages/role/index`
- `pages/login/elder`
- `pages/caregiver/index`
- `pages/admin/index`
- `pages/home/index`
- `pages/pose/camera`
- `pages/pose/history`
- `pages/pose/detail`
- `pages/assessment/index`
- `pages/assessment/report`
- `pages/chat/index`
- `pages/records/index`
- `pages/archive/index`
- `pages/profile/edit`
- `pages/profile/index`

Subpackages:

- `pages/training/index`
- `pages/training/learn`
- `pages/training/practice`
- `pages/training/complete`
- `pages/video/index`

## Services

- `miniprogram/services/authService.js`
- `miniprogram/services/elderService.js`
- `miniprogram/services/trainingService.js`
- `miniprogram/services/assessmentService.js`
- `miniprogram/services/bindingService.js`
- `miniprogram/services/poseService.js`
- `miniprogram/services/voiceService.js`

## AI Capabilities

Pose recognition:

- Aliyun BodyPosture
- Image upload via WeChat cloud storage and Aliyun OSS
- Cloud function: `cloudfunctions/poseService`

Voice Q&A:

- ASR + Qwen + TTS through DashScope-related flow
- TTS audio is cached and returned through WeChat cloud storage
- Cloud function: `cloudfunctions/voiceService`

## Demo Priority

1. Elder path works smoothly.
2. Caregiver binding and overview are credible.
3. Pose recognition is demoable with clear fallback messages.
4. Voice Q&A is useful and not overclaiming medical ability.
5. Docs match code reality.

