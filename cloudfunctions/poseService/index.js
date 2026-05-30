const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const dns = require('dns').promises
const https = require('https')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const records = db.collection('pose_detection_records')
const elders = db.collection('elders')
const standards = db.collection('action_standards')

const ALIYUN_VERSION = '2019-12-30'

function normalizeEndpoint(value, fallback) {
  const raw = String(value || fallback || '').trim()
  return raw
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .trim()
}

const ALIYUN_FACEBODY_ENDPOINT = normalizeEndpoint(
  process.env.ALIYUN_FACEBODY_ENDPOINT,
  'facebody.cn-shanghai.aliyuncs.com'
)
const ALIYUN_FACEBODY_IP = String(process.env.ALIYUN_FACEBODY_IP || '').trim()
const ALIYUN_OSS_ENDPOINT = normalizeEndpoint(
  process.env.ALIYUN_OSS_ENDPOINT,
  'oss-cn-shanghai.aliyuncs.com'
)
const ALIYUN_OSS_BUCKET = String(process.env.ALIYUN_OSS_BUCKET || '').trim()
const ALIYUN_OSS_PREFIX = String(process.env.ALIYUN_OSS_PREFIX || 'xiao-e-pose').trim()

const DEFAULT_STANDARDS = {
  wallSquat: {
    actionKey: 'wallSquat',
    actionName: '靠墙静蹲',
    targetJoint: 'knee',
    standardVersion: 2,
    minAngle: 95,
    maxAngle: 150,
    idealAngle: 125,
    warningAngle: 80,
    suggestion: '膝盖不要超过脚尖，背部贴墙，保持缓慢下蹲。'
  },
  legRaise: {
    actionKey: 'legRaise',
    actionName: '直腿抬高',
    targetJoint: 'knee',
    standardVersion: 4,
    minAngle: 150,
    maxAngle: 180,
    idealAngle: 168,
    warningAngle: 135,
    suggestion: '抬腿时膝盖尽量伸直，动作慢起慢落。'
  },
  singleLegStand: {
    actionKey: 'singleLegStand',
    actionName: '单腿站立',
    targetJoint: 'knee',
    standardVersion: 2,
    minAngle: 150,
    maxAngle: 180,
    idealAngle: 172,
    warningAngle: 135,
    suggestion: '扶稳椅背，支撑腿保持稳定，身体晃动大时先放下脚。'
  }
}

const COCO18_NAMES = [
  'nose',
  'neck',
  'right_shoulder',
  'right_elbow',
  'right_wrist',
  'left_shoulder',
  'left_elbow',
  'left_wrist',
  'right_hip',
  'right_knee',
  'right_ankle',
  'left_hip',
  'left_knee',
  'left_ankle',
  'right_eye',
  'left_eye',
  'right_ear',
  'left_ear'
]

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function getVector(a, b) {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  }
}

function getVectorLength(vector) {
  return Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z)
}

function calculateAngle(a, b, c) {
  const ba = getVector(a, b)
  const bc = getVector(c, b)
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z
  const length = getVectorLength(ba) * getVectorLength(bc)
  if (!length) {
    return 0
  }

  const cos = Math.max(-1, Math.min(1, dot / length))
  return Math.round(Math.acos(cos) * 180 / Math.PI)
}

function createPoint(index, name, x, y, z = 0, score = 0.92) {
  return {
    index,
    name,
    x: toNumber(x),
    y: toNumber(y),
    z: toNumber(z),
    score: toNumber(score, 0.92)
  }
}

function createMockKeypoints(actionKey) {
  const angleMap = {
    wallSquat: { leftKnee: { x: 0.42, y: 0.62, z: 0.02 }, rightKnee: { x: 0.58, y: 0.62, z: 0.02 } },
    legRaise: { leftKnee: { x: 0.42, y: 0.64, z: 0.01 }, rightKnee: { x: 0.59, y: 0.66, z: 0.02 } },
    singleLegStand: { leftKnee: { x: 0.43, y: 0.6, z: 0.01 }, rightKnee: { x: 0.6, y: 0.56, z: 0.08 } }
  }
  const pose = angleMap[actionKey] || angleMap.wallSquat
  const points = []

  for (let index = 0; index < 18; index += 1) {
    points.push(createPoint(index, COCO18_NAMES[index] || `point_${index}`, 0.5, 0.5, 0, 0.65))
  }

  points[8] = createPoint(8, 'right_hip', 0.6, 0.42, 0.02)
  points[9] = createPoint(9, 'right_knee', pose.rightKnee.x, pose.rightKnee.y, pose.rightKnee.z)
  points[10] = createPoint(10, 'right_ankle', 0.62, 0.82, 0.01)
  points[11] = createPoint(11, 'left_hip', 0.4, 0.42, 0.02)
  points[12] = createPoint(12, 'left_knee', pose.leftKnee.x, pose.leftKnee.y, pose.leftKnee.z)
  points[13] = createPoint(13, 'left_ankle', 0.38, 0.82, 0.01)

  return points
}

function pointMap(keypoints) {
  return keypoints.reduce((map, point) => {
    map[point.name] = point
    return map
  }, {})
}

function requirePoint(points, name) {
  if (!points[name]) {
    throw new Error(`姿态识别结果缺少 ${name} 关键点`)
  }
  return points[name]
}

function hasLegKeypoints(points, side) {
  return Boolean(points[`${side}_hip`] && points[`${side}_knee`] && points[`${side}_ankle`])
}

function calculateKneeAngles(keypoints) {
  const points = pointMap(keypoints)
  const left = calculateAngle(
    requirePoint(points, 'left_hip'),
    requirePoint(points, 'left_knee'),
    requirePoint(points, 'left_ankle')
  )
  const right = calculateAngle(
    requirePoint(points, 'right_hip'),
    requirePoint(points, 'right_knee'),
    requirePoint(points, 'right_ankle')
  )

  return {
    leftKnee: left,
    rightKnee: right,
    averageKnee: Math.round((left + right) / 2)
  }
}

function calculateAvailableKneeAngles(keypoints) {
  const points = pointMap(keypoints)
  const hasLeft = hasLegKeypoints(points, 'left')
  const hasRight = hasLegKeypoints(points, 'right')
  if (!hasLeft && !hasRight) {
    throw new Error('姿态识别结果缺少可计算膝关节角度的一侧髋、膝、踝关键点')
  }

  const left = hasLeft ? calculateAngle(points.left_hip, points.left_knee, points.left_ankle) : 0
  const right = hasRight ? calculateAngle(points.right_hip, points.right_knee, points.right_ankle) : 0
  const values = [left, right].filter((value) => value > 0)

  return {
    leftKnee: left,
    rightKnee: right,
    averageKnee: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    hasLeftLeg: hasLeft,
    hasRightLeg: hasRight
  }
}

function calculateWallSquatAngles(keypoints) {
  const points = pointMap(keypoints)
  const base = calculateAvailableKneeAngles(keypoints)
  const leftKneeForward = base.hasLeftLeg ? Math.abs(points.left_knee.x - points.left_ankle.x) : 0
  const rightKneeForward = base.hasRightLeg ? Math.abs(points.right_knee.x - points.right_ankle.x) : 0
  const leftHipDrop = base.hasLeftLeg ? Math.max(0, points.left_hip.y - points.left_knee.y) : 0
  const rightHipDrop = base.hasRightLeg ? Math.max(0, points.right_hip.y - points.right_knee.y) : 0
  const leftScore = base.hasLeftLeg
    ? (180 - base.leftKnee) * 1.2 + leftKneeForward * 60 + leftHipDrop * 20
    : -1
  const rightScore = base.hasRightLeg
    ? (180 - base.rightKnee) * 1.2 + rightKneeForward * 60 + rightHipDrop * 20
    : -1
  const activeSide = leftScore >= rightScore ? 'left' : 'right'

  return {
    ...base,
    activeSide,
    activeKnee: activeSide === 'left' ? base.leftKnee : base.rightKnee,
    activeKneeForward: Number((activeSide === 'left' ? leftKneeForward : rightKneeForward).toFixed(3)),
    activeHipDrop: Number((activeSide === 'left' ? leftHipDrop : rightHipDrop).toFixed(3)),
    leftKneeForward: Number(leftKneeForward.toFixed(3)),
    rightKneeForward: Number(rightKneeForward.toFixed(3))
  }
}

function calculateLineAngle(a, b) {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  if (!dx && !dy) {
    return 90
  }
  return Math.round(Math.atan2(dy, dx) * 180 / Math.PI)
}

function scoreAngleTarget(angle, ideal, softRange, floor = 40, slope = 1.6) {
  const distance = Math.max(0, Math.abs(toNumber(angle, ideal) - ideal) - softRange)
  return Math.max(floor, Math.min(100, 100 - distance * slope))
}

function scoreLegRaiseSeatedAngle(lineAngle) {
  return scoreAngleTarget(lineAngle, 10, 18, 38, 2)
}

function scoreLegRaiseVerticalAngle(lineAngle) {
  return scoreAngleTarget(lineAngle, 82, 12, 38, 2)
}

function scoreLegRaiseTorsoUpright(lineAngle) {
  return scoreAngleTarget(lineAngle, 82, 14, 46, 2)
}

function getTorsoLineAngle(points, preferredSide) {
  const shoulderOrder = preferredSide === 'right'
    ? ['right_shoulder', 'left_shoulder']
    : ['left_shoulder', 'right_shoulder']
  const hipOrder = preferredSide === 'right'
    ? ['right_hip', 'left_hip']
    : ['left_hip', 'right_hip']
  const shoulder = shoulderOrder.map((name) => points[name]).find(Boolean)
  const hip = hipOrder.map((name) => points[name]).find(Boolean)
  if (!shoulder || !hip) {
    return null
  }
  return calculateLineAngle(shoulder, hip)
}

function getLegRaiseFeatures(points, side, kneeAngle) {
  if (!hasLegKeypoints(points, side)) {
    return null
  }

  const hip = points[`${side}_hip`]
  const knee = points[`${side}_knee`]
  const ankle = points[`${side}_ankle`]

  return {
    side,
    knee: kneeAngle,
    legLineAngle: calculateLineAngle(hip, ankle),
    shinLineAngle: calculateLineAngle(knee, ankle),
    legSpan: Math.abs(hip.x - ankle.x),
    lift: Math.max(0, hip.y - ankle.y),
    drop: Math.max(0, ankle.y - hip.y)
  }
}

function buildLegRaiseCandidate(variant, active, inactive, torsoLineAngle) {
  if (!active) {
    return null
  }

  const straightScore = scoreByStandard(active.knee, DEFAULT_STANDARDS.legRaise)
  const torsoScore = torsoLineAngle == null ? 72 : scoreLegRaiseTorsoUpright(torsoLineAngle)
  let lineScore = scoreLegRaiseSeatedAngle(active.legLineAngle)

  if (active.lift > 0.16) {
    lineScore = Math.max(38, lineScore - (active.lift - 0.16) * 180)
  }

  let inactiveScore = 68
  if (inactive) {
    const verticalScore = scoreLegRaiseVerticalAngle(inactive.legLineAngle)
    const dropScore = Math.max(45, Math.min(100, 55 + inactive.drop * 170))
    inactiveScore = verticalScore * 0.65 + dropScore * 0.35
  }

  const score = straightScore * 0.46 + lineScore * 0.3 + torsoScore * 0.14 + inactiveScore * 0.1

  return {
    variant,
    score,
    activeSide: active.side,
    inactiveSide: inactive ? inactive.side : '',
    activeKnee: active.knee,
    inactiveKnee: inactive ? inactive.knee : 0,
    activeLegLineAngle: active.legLineAngle,
    inactiveLegLineAngle: inactive ? inactive.legLineAngle : 0,
    activeShinLineAngle: active.shinLineAngle,
    activeLegSpan: active.legSpan,
    activeLegLift: active.lift,
    inactiveLegDrop: inactive ? inactive.drop : 0,
    torsoLineAngle,
    straightScore: Number(straightScore.toFixed(1)),
    lineScore: Number(lineScore.toFixed(1)),
    inactiveScore: Number(inactiveScore.toFixed(1)),
    torsoScore: Number(torsoScore.toFixed(1))
  }
}

function calculateLegRaiseAngles(keypoints) {
  const points = pointMap(keypoints)
  const base = calculateAvailableKneeAngles(keypoints)
  const left = base.hasLeftLeg ? getLegRaiseFeatures(points, 'left', base.leftKnee) : null
  const right = base.hasRightLeg ? getLegRaiseFeatures(points, 'right', base.rightKnee) : null
  const candidates = []

  if (left) {
    candidates.push(buildLegRaiseCandidate('seated', left, right, getTorsoLineAngle(points, 'left')))
  }
  if (right) {
    candidates.push(buildLegRaiseCandidate('seated', right, left, getTorsoLineAngle(points, 'right')))
  }

  const best = candidates
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)[0]

  if (!best) {
    throw new Error('直腿抬高未能组合出可用的动作特征')
  }

  return {
    ...base,
    poseVariant: best.variant,
    activeSide: best.activeSide,
    inactiveSide: best.inactiveSide,
    activeKnee: best.activeKnee,
    inactiveKnee: best.inactiveKnee,
    activeLegLineAngle: Math.round(best.activeLegLineAngle),
    inactiveLegLineAngle: Math.round(best.inactiveLegLineAngle || 0),
    activeShinLineAngle: Math.round(best.activeShinLineAngle),
    activeLegSpan: Number(best.activeLegSpan.toFixed(3)),
    activeLegLift: Number(best.activeLegLift.toFixed(3)),
    inactiveLegDrop: Number((best.inactiveLegDrop || 0).toFixed(3)),
    torsoLineAngle: best.torsoLineAngle == null ? null : Math.round(best.torsoLineAngle),
    variantScore: Math.round(best.score),
    variantConfidence: {
      straightScore: best.straightScore,
      lineScore: best.lineScore,
      inactiveScore: best.inactiveScore,
      torsoScore: best.torsoScore
    },
    leftLegLineAngle: left ? Math.round(left.legLineAngle) : 0,
    rightLegLineAngle: right ? Math.round(right.legLineAngle) : 0
  }
}

function calculateSingleLegStandAngles(keypoints) {
  const points = pointMap(keypoints)
  const base = calculateKneeAngles(keypoints)
  const leftAnkle = requirePoint(points, 'left_ankle')
  const rightAnkle = requirePoint(points, 'right_ankle')
  const ankleDiff = Math.abs(leftAnkle.y - rightAnkle.y)
  const supportSide = ankleDiff > 0.035
    ? (leftAnkle.y >= rightAnkle.y ? 'left' : 'right')
    : (base.leftKnee >= base.rightKnee ? 'left' : 'right')
  const liftSide = supportSide === 'left' ? 'right' : 'left'
  const supportAnkle = supportSide === 'left' ? leftAnkle : rightAnkle
  const liftAnkle = supportSide === 'left' ? rightAnkle : leftAnkle

  return {
    ...base,
    supportSide,
    supportKnee: supportSide === 'left' ? base.leftKnee : base.rightKnee,
    liftSide,
    liftKnee: liftSide === 'left' ? base.leftKnee : base.rightKnee,
    liftAnkleRaise: Number(Math.max(0, supportAnkle.y - liftAnkle.y).toFixed(3))
  }
}

function ensureKneeKeypoints(keypoints, actionKey = '') {
  const pointNames = pointMap(keypoints)
  const required = ['left_hip', 'left_knee', 'left_ankle', 'right_hip', 'right_knee', 'right_ankle']
  if ((actionKey === 'wallSquat' || actionKey === 'legRaise') && (hasLegKeypoints(pointNames, 'left') || hasLegKeypoints(pointNames, 'right'))) {
    return
  }
  const missing = required.filter((name) => !pointNames[name])
  if (missing.length > 0) {
    const labels = keypoints.map((point) => point.name).join(',')
    throw new Error(`阿里云 BodyPosture 缺少膝关节计算关键点：${missing.join(',')}；已返回标签：${labels}`)
  }
}

function scoreByStandard(angle, standard) {
  const min = toNumber(standard.minAngle)
  const max = toNumber(standard.maxAngle)
  const ideal = toNumber(standard.idealAngle, Math.round((min + max) / 2))
  const warning = toNumber(standard.warningAngle, min)

  if (angle >= min && angle <= max) {
    const distance = Math.abs(angle - ideal)
    return Math.max(88, 100 - distance)
  }

  const nearBoundary = angle < min ? min - angle : angle - max
  const baseScore = Math.max(55, 86 - nearBoundary * 2)
  if (angle < warning || angle > max + 28) {
    return Math.min(baseScore, 68)
  }
  return baseScore
}

function buildAssessment(angle, standard) {
  const score = Math.round(scoreByStandard(angle, standard))
  let riskLevel = 'low'
  let riskText = '动作稳定'
  let suggestion = standard.suggestion

  if (score < 70) {
    riskLevel = 'high'
    riskText = '需要关注'
    suggestion = `建议降低动作幅度，必要时请家人协助。${standard.suggestion}`
  } else if (score < 86) {
    riskLevel = 'middle'
    riskText = '可以改进'
    suggestion = `动作基本完成，可以继续放慢节奏。${standard.suggestion}`
  }

  return {
    score,
    riskLevel,
    riskText,
    suggestion
  }
}

function buildLegRaiseAssessment(angles, standard) {
  const score = Math.round(Math.max(45, Math.min(100, toNumber(angles.variantScore, 0) || scoreByStandard(angles.activeKnee, standard))))
  const legLineAngle = toNumber(angles.activeLegLineAngle, 90)
  let riskLevel = 'low'
  let riskText = '动作稳定'
  let suggestion = '当前只按坐姿抬腿识别：坐稳后把一条腿慢慢伸直向前，另一条腿自然下垂。'

  if (score < 70) {
    riskLevel = 'high'
    riskText = '需要关注'
    suggestion = angles.activeKnee < standard.minAngle
      ? '这次坐姿抬腿时，抬起那条腿还没完全伸直。先坐稳，再把膝盖伸直后往前送平一点。'
      : legLineAngle > 32
        ? '这次坐姿抬腿时，抬起那条腿还不够平。请把腿再往前伸一点，尽量让大腿到脚踝接近平着。'
        : '这次坐姿抬腿还不够稳。请保持上身坐稳，另一条腿自然下垂，抬起那条腿慢慢做。'
  } else if (score < 86) {
    riskLevel = 'middle'
    riskText = '可以改进'
    suggestion = legLineAngle > 26
      ? '坐姿抬腿已经基本完成，可以再把抬起那条腿送平一点，动作会更标准。'
      : '坐姿抬腿已经基本完成，继续保持坐稳、抬腿慢、落腿慢。'
  }

  return {
    score,
    riskLevel,
    riskText,
    suggestion
  }
}

function buildWallSquatAssessment(angles, standard) {
  const activeKnee = toNumber(angles.activeKnee || angles.averageKnee, 180)
  let angleScore = scoreByStandard(activeKnee, standard)
  const forward = toNumber(angles.activeKneeForward, 0)

  if (activeKnee > 165) {
    angleScore = Math.min(angleScore, 48)
  } else if (activeKnee > 155) {
    angleScore = Math.min(angleScore, 72)
  }
  if (forward < 0.018 && activeKnee > 150) {
    angleScore -= 18
  }

  const score = Math.round(Math.max(45, Math.min(100, angleScore)))
  let riskLevel = 'low'
  let riskText = '动作稳定'
  let suggestion = `${standard.suggestion}靠墙静蹲请尽量用侧前方拍摄，让髋、膝、踝都在画面里。`

  if (score < 70) {
    riskLevel = 'high'
    riskText = '需要关注'
    suggestion = activeKnee > 155
      ? '下蹲幅度还不明显，请背部贴墙，脚向前一点，慢慢下蹲到膝盖有轻微弯曲。'
      : '下蹲幅度偏大或姿势不稳，请稍微站高一点，扶稳后再练。'
  } else if (score < 86) {
    riskLevel = 'middle'
    riskText = '可以改进'
    suggestion = '动作基本完成，建议手机放在身体侧前方，继续保持背部贴墙和慢慢下蹲。'
  }

  return {
    score,
    riskLevel,
    riskText,
    suggestion
  }
}

function buildSingleLegStandAssessment(angles, standard) {
  const supportScore = scoreByStandard(angles.supportKnee, standard)
  const liftRaise = toNumber(angles.liftAnkleRaise, 0)
  const liftKnee = toNumber(angles.liftKnee, 180)
  let liftScore = 100

  if (liftRaise < 0.035 && liftKnee > 155) {
    liftScore -= 65
  } else if (liftRaise < 0.025) {
    liftScore -= 22
  }
  if (liftKnee > 168) {
    liftScore -= 25
  }

  const score = Math.round(Math.max(45, Math.min(100, supportScore * 0.68 + liftScore * 0.32)))
  let riskLevel = 'low'
  let riskText = '动作稳定'
  let suggestion = `${standard.suggestion}本动作主要看支撑腿是否稳定，不要求抬起腿伸直。`

  if (score < 70) {
    riskLevel = 'high'
    riskText = '需要关注'
    suggestion = liftRaise < 0.035 && liftKnee > 155
      ? '还没有形成明显单腿站立，请扶稳椅背后再慢慢抬起一只脚。'
      : '支撑腿还不够稳定，先扶稳椅背，身体晃动大时先放下脚。'
  } else if (score < 86) {
    riskLevel = 'middle'
    riskText = '可以改进'
    suggestion = '动作基本完成，继续扶稳椅背，支撑腿保持直立，脚抬起一点即可。'
  }

  return {
    score,
    riskLevel,
    riskText,
    suggestion
  }
}

function calculateAnglesByAction(keypoints, actionKey) {
  if (actionKey === 'wallSquat') {
    return calculateWallSquatAngles(keypoints)
  }
  if (actionKey === 'legRaise') {
    return calculateLegRaiseAngles(keypoints)
  }
  if (actionKey === 'singleLegStand') {
    return calculateSingleLegStandAngles(keypoints)
  }
  return calculateKneeAngles(keypoints)
}

function buildAssessmentByAction(angles, standard) {
  if (standard.actionKey === 'wallSquat') {
    return buildWallSquatAssessment(angles, standard)
  }
  if (standard.actionKey === 'legRaise') {
    return buildLegRaiseAssessment(angles, standard)
  }
  if (standard.actionKey === 'singleLegStand') {
    return buildSingleLegStandAssessment(angles, standard)
  }
  return buildAssessment(angles.averageKnee, standard)
}

function buildDetectionFailureAssessment(actionKey) {
  const suffix = '请调整拍摄角度后重试。'

  if (actionKey === 'legRaise') {
    return {
      score: 0,
      riskLevel: 'high',
      riskText: '识别失败',
      suggestion: `本次没有识别到有效骨架点。直腿抬高现在只支持坐姿做法，请从身体侧面拍，把腰胯、抬起腿和自然下垂那条腿一起拍完整。${suffix}`
    }
  }

  if (actionKey === 'wallSquat') {
    return {
      score: 0,
      riskLevel: 'high',
      riskText: '识别失败',
      suggestion: `本次没有识别到有效骨架点。请从身体侧前方拍，把髋、膝、踝都放进画面，再重新检测。${suffix}`
    }
  }

  if (actionKey === 'singleLegStand') {
    return {
      score: 0,
      riskLevel: 'high',
      riskText: '识别失败',
      suggestion: `本次没有识别到有效骨架点。请把支撑腿、抬起腿和双脚都拍完整，再重新检测。${suffix}`
    }
  }

  return {
    score: 0,
    riskLevel: 'high',
    riskText: '识别失败',
    suggestion: `本次没有识别到有效骨架点。${suffix}`
  }
}

function getAliyunAccessKeyId() {
  return process.env.ALIYUN_ACCESS_KEY_ID || ''
}

function getAliyunAccessKeySecret() {
  return process.env.ALIYUN_ACCESS_KEY_SECRET || ''
}

function hasAliyunConfig() {
  return Boolean(getAliyunAccessKeyId() && getAliyunAccessKeySecret())
}

function hasAliyunOssConfig() {
  return Boolean(ALIYUN_OSS_BUCKET && ALIYUN_OSS_ENDPOINT)
}

function percentEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/'/g, '%27')
}

function canonicalize(params) {
  return Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&')
}

function createRpcSignature(params, method = 'POST') {
  const canonicalizedQuery = canonicalize(params)
  const stringToSign = `${method}&${percentEncode('/')}&${percentEncode(canonicalizedQuery)}`
  return crypto
    .createHmac('sha1', `${getAliyunAccessKeySecret()}&`)
    .update(stringToSign)
    .digest('base64')
}

function createAliyunParams(imageURL) {
  const params = {
    Action: 'BodyPosture',
    Version: ALIYUN_VERSION,
    Format: 'JSON',
    AccessKeyId: getAliyunAccessKeyId(),
    SignatureMethod: 'HMAC-SHA1',
    SignatureVersion: '1.0',
    SignatureNonce: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    ImageURL: imageURL
  }

  return {
    ...params,
    Signature: createRpcSignature(params)
  }
}

function requestAliyun(params) {
  const body = canonicalize(params)
  const hostname = ALIYUN_FACEBODY_IP || ALIYUN_FACEBODY_ENDPOINT

  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname,
      servername: ALIYUN_FACEBODY_ENDPOINT,
      path: '/',
      method: 'POST',
      headers: {
        Host: ALIYUN_FACEBODY_ENDPOINT,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 10000
    }, (response) => {
      let raw = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        raw += chunk
      })
      response.on('end', () => {
        let payload = null
        try {
          payload = raw ? JSON.parse(raw) : {}
        } catch (error) {
          reject(new Error(`阿里云 BodyPosture 返回非 JSON：${raw.slice(0, 120)}`))
          return
        }

        if (response.statusCode >= 400 || payload.Code) {
          reject(new Error(payload.Message || payload.Code || `阿里云 BodyPosture HTTP ${response.statusCode}`))
          return
        }

        resolve(payload)
      })
    })

    request.on('timeout', () => {
      reject(new Error('阿里云 BodyPosture 请求超时'))
      request.destroy()
    })
    request.on('error', reject)
    request.write(body)
    request.end()
  })
}

function encodeOssObjectKey(objectKey) {
  return String(objectKey).split('/').map(encodeURIComponent).join('/')
}

function createOssSignature(method, contentType, dateOrExpires, objectKey) {
  const canonicalResource = `/${ALIYUN_OSS_BUCKET}/${objectKey}`
  const stringToSign = `${method}\n\n${contentType || ''}\n${dateOrExpires}\n${canonicalResource}`
  return crypto
    .createHmac('sha1', getAliyunAccessKeySecret())
    .update(stringToSign)
    .digest('base64')
}

function extractXmlMessage(raw) {
  const matched = String(raw || '').match(/<Message>([\s\S]*?)<\/Message>/)
  return matched ? matched[1] : String(raw || '').slice(0, 200)
}

function uploadBufferToOss(buffer, objectKey, contentType = 'image/jpeg') {
  const hostname = `${ALIYUN_OSS_BUCKET}.${ALIYUN_OSS_ENDPOINT}`
  const date = new Date().toUTCString()
  const signature = createOssSignature('PUT', contentType, date, objectKey)
  const path = `/${encodeOssObjectKey(objectKey)}`

  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname,
      path,
      method: 'PUT',
      headers: {
        Date: date,
        Host: hostname,
        Authorization: `OSS ${getAliyunAccessKeyId()}:${signature}`,
        'Content-Type': contentType,
        'Content-Length': buffer.length
      },
      timeout: 10000
    }, (response) => {
      let raw = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        raw += chunk
      })
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve()
          return
        }
        reject(new Error(`OSS 上传失败：${response.statusCode} ${extractXmlMessage(raw)}`))
      })
    })

    request.on('timeout', () => {
      reject(new Error('OSS 上传超时'))
      request.destroy()
    })
    request.on('error', reject)
    request.write(buffer)
    request.end()
  })
}

function createSignedOssURL(objectKey, ttlSeconds = 600) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds
  const signature = createOssSignature('GET', '', expires, objectKey)
  const path = encodeOssObjectKey(objectKey)
  return `https://${ALIYUN_OSS_BUCKET}.${ALIYUN_OSS_ENDPOINT}/${path}?OSSAccessKeyId=${percentEncode(getAliyunAccessKeyId())}&Expires=${expires}&Signature=${percentEncode(signature)}`
}

function getContentTypeFromPath(cloudPath) {
  const lower = String(cloudPath || '').toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.bmp')) return 'image/bmp'
  return 'image/jpeg'
}

function downloadBufferFromURL(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      timeout: 10000
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadBufferFromURL(response.headers.location).then(resolve).catch(reject)
        return
      }

      if (response.statusCode !== 200) {
        reject(new Error(`下载微信云存储图片失败：HTTP ${response.statusCode}`))
        response.resume()
        return
      }

      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
    }).on('timeout', function onTimeout() {
      reject(new Error('下载微信云存储图片超时'))
      this.destroy()
    }).on('error', reject)
  })
}

async function getTempImageURL(fileID) {
  const result = await cloud.getTempFileURL({
    fileList: [fileID]
  })
  const file = result.fileList && result.fileList[0]
  if (!file || !file.tempFileURL) {
    throw new Error('无法生成云存储图片临时访问链接')
  }
  return file.tempFileURL
}

function buildOssObjectKey(actionKey, cloudPath) {
  const suffix = String(cloudPath || '').split('.').pop() || 'jpg'
  const safeAction = String(actionKey || 'knee').replace(/[^a-zA-Z0-9_-]/g, '')
  return `${ALIYUN_OSS_PREFIX}/${safeAction}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${suffix}`
}

async function uploadWechatImageToOss(fileID, actionKey, cloudPath) {
  if (!hasAliyunOssConfig()) {
    throw new Error('缺少 ALIYUN_OSS_BUCKET，请先创建上海地域 OSS Bucket 并配置云函数环境变量')
  }

  const wechatImageURL = await getTempImageURL(fileID)
  const imageBuffer = await downloadBufferFromURL(wechatImageURL)
  if (imageBuffer.length > 3 * 1024 * 1024) {
    throw new Error('图片超过 3MB，请降低拍照质量或压缩后再检测')
  }

  const objectKey = buildOssObjectKey(actionKey, cloudPath)
  await uploadBufferToOss(imageBuffer, objectKey, getContentTypeFromPath(cloudPath))

  return {
    imageURL: createSignedOssURL(objectKey),
    ossObjectKey: objectKey
  }
}

function parseMaybeJSON(value) {
  if (typeof value !== 'string') {
    return value
  }

  const text = value.trim()
  if (!text || (text[0] !== '{' && text[0] !== '[')) {
    return value
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    return value
  }
}

function normalizePointName(point, index) {
  const rawName = String(
    point.name ||
    point.Name ||
    point.label ||
    point.Label ||
    point.part ||
    point.Part ||
    point.key ||
    ''
  ).toLowerCase()

  if (rawName.includes('left') && rawName.includes('hip')) return 'left_hip'
  if (rawName.includes('left') && rawName.includes('knee')) return 'left_knee'
  if (rawName.includes('left') && rawName.includes('ankle')) return 'left_ankle'
  if (rawName.includes('right') && rawName.includes('hip')) return 'right_hip'
  if (rawName.includes('right') && rawName.includes('knee')) return 'right_knee'
  if (rawName.includes('right') && rawName.includes('ankle')) return 'right_ankle'

  return COCO18_NAMES[index] || rawName || `point_${index}`
}

function extractPointArray(value, depth = 0) {
  if (!value || depth > 5) {
    return null
  }

  const current = parseMaybeJSON(value)
  if (Array.isArray(current)) {
    if (current.length > 0 && typeof current[0] === 'object') {
      const looksLikePoints = current.some((item) => {
        return item && (
          item.x !== undefined ||
          item.X !== undefined ||
          item.y !== undefined ||
          item.Y !== undefined ||
          item.score !== undefined ||
          item.Score !== undefined
        )
      })
      if (looksLikePoints) {
        return current
      }
    }

    for (const item of current) {
      const found = extractPointArray(item, depth + 1)
      if (found) {
        return found
      }
    }
  }

  if (typeof current === 'object') {
    const directKeys = [
      'KeyPoints',
      'Keypoints',
      'keypoints',
      'KeyPointsList',
      'Landmarks',
      'landmarks',
      'Points',
      'points',
      'BodyPoints',
      'bodyPoints',
      'Positions',
      'positions',
      'PosePoints',
      'posePoints'
    ]
    for (const key of directKeys) {
      const found = extractPointArray(current[key], depth + 1)
      if (found) {
        return found
      }
    }

    for (const key of Object.keys(current)) {
      const found = extractPointArray(current[key], depth + 1)
      if (found) {
        return found
      }
    }
  }

  return null
}

function normalizeCoordinate(value, size) {
  const number = toNumber(value)
  if (number > 1 && size > 1) {
    return number / size
  }
  return number
}

function isUsableKeypoint(point) {
  const score = toNumber(point && point.score, 0)
  const x = toNumber(point && point.x, 0)
  const y = toNumber(point && point.y, 0)
  return score > 0 && !(x === 0 && y === 0)
}

function summarizeAliyunData(data) {
  const outputItems = Array.isArray(data && data.Outputs)
    ? data.Outputs
    : data && data.Outputs
      ? [data.Outputs]
      : []
  const firstOutput = outputItems[0] || {}
  const resultItems = Array.isArray(firstOutput.Results)
    ? firstOutput.Results
    : firstOutput.Results
      ? [firstOutput.Results]
      : []
  const firstResult = resultItems[0] || {}
  const bodies = Array.isArray(firstResult.Bodies)
    ? firstResult.Bodies
    : firstResult.Bodies
      ? [firstResult.Bodies]
      : []

  return {
    dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
    humanCount: firstOutput && firstOutput.HumanCount !== undefined
      ? firstOutput.HumanCount
      : data && data.HumanCount !== undefined
        ? data.HumanCount
        : undefined,
    outputsCount: outputItems.length,
    firstOutputKeys: firstOutput && typeof firstOutput === 'object' ? Object.keys(firstOutput) : [],
    resultsCount: resultItems.length,
    firstResultKeys: firstResult && typeof firstResult === 'object' ? Object.keys(firstResult) : [],
    bodiesCount: bodies.length,
    labels: bodies.map((body) => body && body.Label).filter(Boolean)
  }
}

function normalizeAliyunKeypoints(response, actionKey = '') {
  const data = parseMaybeJSON(response.Data || response.data || response)
  const width = toNumber(data && (data.Width || data.width || data.ImageWidth || data.imageWidth || data.MetaObject && (data.MetaObject.Width || data.MetaObject.width)), 0)
  const height = toNumber(data && (data.Height || data.height || data.ImageHeight || data.imageHeight || data.MetaObject && (data.MetaObject.Height || data.MetaObject.height)), 0)

  const outputs = data && data.Outputs !== undefined ? data.Outputs : null
  const outputItems = Array.isArray(outputs) ? outputs : outputs ? [outputs] : []
  const resultItems = []

  outputItems.forEach((output) => {
    const results = output && output.Results !== undefined ? output.Results : output
    const items = Array.isArray(results) ? results : results ? [results] : []
    items.forEach((item) => {
      if (item) {
        resultItems.push(item)
      }
    })
  })

  const bodies = []
  resultItems.forEach((resultItem) => {
    const resultBodies = resultItem && resultItem.Bodies !== undefined ? resultItem.Bodies : null
    const bodyItems = Array.isArray(resultBodies) ? resultBodies : resultBodies ? [resultBodies] : []
    bodyItems.forEach((body) => {
      if (body) {
        bodies.push(body)
      }
    })
  })

  if (bodies.length === 0) {
    const fallbackRawPoints = extractPointArray(data)
    if (!fallbackRawPoints || fallbackRawPoints.length < 14) {
      throw new Error(`阿里云 BodyPosture 未返回可用的人体关键点；返回摘要：${JSON.stringify(summarizeAliyunData(data))}`)
    }

    const fallbackKeypoints = fallbackRawPoints.map((point, index) => {
      const x = point.x !== undefined ? point.x : point.X
      const y = point.y !== undefined ? point.y : point.Y
      const z = point.z !== undefined ? point.z : point.Z
      const score = point.score !== undefined
        ? point.score
        : point.Score !== undefined
          ? point.Score
          : point.Confidence !== undefined
            ? point.Confidence
            : point.Confident

      return createPoint(
        index,
        normalizePointName(point, index),
        normalizeCoordinate(x, width),
        normalizeCoordinate(y, height),
        z || 0,
        score === undefined ? 0.9 : score
      )
    }).filter(isUsableKeypoint)

    ensureKneeKeypoints(fallbackKeypoints, actionKey)
    return fallbackKeypoints
  }

  const keypoints = bodies.map((body, index) => {
    const label = String(body.Label || body.label || `point_${index}`).toLowerCase()
    const positions = body.Positions || body.positions || {}
    const position = Array.isArray(positions) ? positions[0] : positions
    const points = Array.isArray(position && position.Points)
      ? position.Points
      : Array.isArray(position && position.points)
        ? position.points
        : []
    const x = points[0]
    const y = points[1]
    const score = body.Confident !== undefined ? body.Confident : body.confident

    return createPoint(
      index,
      normalizePointName({ label }, index) || label,
      normalizeCoordinate(x, width),
      normalizeCoordinate(y, height),
      0,
      score === undefined ? 0.9 : score
    )
  }).filter(isUsableKeypoint)

  ensureKneeKeypoints(keypoints, actionKey)

  return keypoints
}

async function detectKeypoints(fileID, actionKey, cloudPath) {
  if (!hasAliyunConfig()) {
    return {
      keypoints: [],
      engine: 'aliyun-config-missing',
      imageURL: '',
      ossObjectKey: '',
      apiError: '未配置阿里云 AccessKey 环境变量'
    }
  }

  try {
    const image = await uploadWechatImageToOss(fileID, actionKey, cloudPath)
    const response = await requestAliyun(createAliyunParams(image.imageURL))
    return {
      keypoints: normalizeAliyunKeypoints(response, actionKey),
      engine: 'aliyun-body-posture-v1',
      imageURL: image.imageURL,
      ossObjectKey: image.ossObjectKey,
      apiRequestId: response.RequestId || '',
      apiError: ''
    }
  } catch (error) {
    console.warn('[poseService] FAILED:', error.message)
    return {
      keypoints: [],
      engine: 'aliyun-request-failed',
      imageURL: '',
      ossObjectKey: '',
      apiError: error.message || '阿里云 BodyPosture 调用失败'
    }
  }
}

async function getCurrentElder(openid) {
  const result = await elders.where({ ownerOpenId: openid }).limit(1).get()
  return result.data[0] || null
}

async function getStandard(actionKey) {
  const builtIn = DEFAULT_STANDARDS[actionKey] || DEFAULT_STANDARDS.wallSquat
  try {
    const result = await standards.where({ actionKey }).limit(1).get()
    if (result.data.length > 0) {
      const saved = result.data[0]
      const savedVersion = Number(saved.standardVersion || 0)
      const builtInVersion = Number(builtIn.standardVersion || 0)
      if (savedVersion < builtInVersion) {
        return {
          ...saved,
          ...builtIn,
          _id: saved._id
        }
      }
      return {
        ...builtIn,
        ...saved
      }
    }
  } catch (error) {
    console.warn('read action standard failed, fallback to built-in standard', error)
  }

  return builtIn
}

async function analyzePose(event) {
  const { OPENID } = cloud.getWXContext()
  const fileID = String(event.data && event.data.fileID || '').trim()
  const cloudPath = String(event.data && event.data.cloudPath || '').trim()
  const actionKey = String(event.data && event.data.actionKey || 'wallSquat').trim()
  const mediaType = String(event.data && event.data.mediaType || 'image').trim()
  const source = String(event.data && event.data.source || 'poseDetection').trim()
  const trainingLevelId = Number(event.data && event.data.trainingLevelId) || 0

  if (!fileID) {
    return {
      success: false,
      errMsg: '缺少检测图片 fileID'
    }
  }

  const elder = await getCurrentElder(OPENID)
  const standard = await getStandard(actionKey)
  const detection = await detectKeypoints(fileID, actionKey, cloudPath)
  const detectionSuccess = detection.engine === 'aliyun-body-posture-v1'
  const angles = detectionSuccess ? calculateAnglesByAction(detection.keypoints, standard.actionKey) : {}
  const assessment = detectionSuccess
    ? buildAssessmentByAction(angles, standard)
    : buildDetectionFailureAssessment(standard.actionKey, detection.apiError)
  const record = {
    ownerOpenId: OPENID,
    elderId: elder ? elder._id : '',
    elderName: elder ? elder.name : '',
    actionKey: standard.actionKey,
    actionName: standard.actionName,
    fileID,
    cloudPath,
    ossObjectKey: detection.ossObjectKey || '',
    mediaType,
    source,
    trainingLevelId,
    keypoints: detectionSuccess ? detection.keypoints : [],
    angles,
    standard: {
      minAngle: standard.minAngle,
      maxAngle: standard.maxAngle,
      idealAngle: standard.idealAngle,
      warningAngle: standard.warningAngle
    },
    score: assessment.score,
    riskLevel: assessment.riskLevel,
    riskText: assessment.riskText,
    suggestion: assessment.suggestion,
    engine: detection.engine,
    apiProvider: 'aliyun',
    apiRequestId: detection.apiRequestId || '',
    apiError: detection.apiError || '',
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  }

  const result = await records.add({ data: record })
  return {
    success: true,
    data: {
      _id: result._id,
      ...record
    }
  }
}

async function getLatest() {
  const { OPENID } = cloud.getWXContext()
  const result = await records
    .where({ ownerOpenId: OPENID })
    .orderBy('createdAt', 'desc')
    .limit(1)
    .field({ keypoints: false })
    .get()

  return {
    success: true,
    data: result.data[0] || null
  }
}

async function listHistory(event) {
  const { OPENID } = cloud.getWXContext()
  const limit = Math.min(Math.max(Number(event.data && event.data.limit) || 20, 1), 50)
  const result = await records
    .where({ ownerOpenId: OPENID })
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .field({ keypoints: false })
    .get()

  return {
    success: true,
    data: result.data
  }
}

async function clearMine() {
  const { OPENID } = cloud.getWXContext()
  let removed = 0

  while (true) {
    const result = await records.where({ ownerOpenId: OPENID }).limit(100).get()
    const ids = result.data.map((item) => item._id).filter(Boolean)
    if (!ids.length) {
      break
    }

    await Promise.all(ids.map((id) => records.doc(id).remove().catch(() => null)))
    removed += ids.length

    if (ids.length < 100) {
      break
    }
  }

  return {
    success: true,
    data: {
      removed
    }
  }
}

async function getDetail(event) {
  const { OPENID } = cloud.getWXContext()
  const id = String(event.data && event.data.id || event.data && event.data._id || '').trim()
  if (!id) {
    return {
      success: false,
      errMsg: '缺少检测记录 id'
    }
  }

  const result = await records
    .where({
      _id: id,
      ownerOpenId: OPENID
    })
    .limit(1)
    .get()

  const record = result.data[0] || null
  if (!record) {
    return {
      success: false,
      errMsg: '没有找到这条检测记录'
    }
  }

  let previous = null
  if (record.createdAt) {
    const previousResult = await records
      .where({
        ownerOpenId: OPENID,
        actionKey: record.actionKey,
        createdAt: _.lt(record.createdAt)
      })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .field({ keypoints: false })
      .get()
    previous = previousResult.data[0] || null
  }

  return {
    success: true,
    data: {
      record,
      previous
    }
  }
}

async function listStandards() {
  return {
    success: true,
    data: Object.keys(DEFAULT_STANDARDS).map((key) => DEFAULT_STANDARDS[key])
  }
}

async function initStandards() {
  const keys = Object.keys(DEFAULT_STANDARDS)
  const results = []

  for (const actionKey of keys) {
    const standard = DEFAULT_STANDARDS[actionKey]
    const existing = await standards.where({ actionKey }).limit(1).get()

    if (existing.data.length > 0) {
      await standards.doc(existing.data[0]._id).update({
        data: {
          ...standard,
          updatedAt: db.serverDate()
        }
      })
      results.push({ actionKey, status: 'updated' })
    } else {
      await standards.add({
        data: {
          ...standard,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      })
      results.push({ actionKey, status: 'created' })
    }
  }

  return {
    success: true,
    data: results
  }
}

async function diagnoseNetwork() {
  const targets = [
    ALIYUN_FACEBODY_ENDPOINT,
    ALIYUN_FACEBODY_IP,
    ALIYUN_OSS_ENDPOINT,
    ALIYUN_OSS_BUCKET ? `${ALIYUN_OSS_BUCKET}.${ALIYUN_OSS_ENDPOINT}` : ''
  ].filter(Boolean)

  const results = []
  for (const hostname of targets) {
    try {
      const addresses = await dns.lookup(hostname, { all: true })
      results.push({
        hostname,
        ok: true,
        addresses: addresses.map((item) => item.address)
      })
    } catch (error) {
      results.push({
        hostname,
        ok: false,
        errMsg: error.message || String(error)
      })
    }
  }

  return {
    success: true,
    data: {
      facebodyEndpoint: ALIYUN_FACEBODY_ENDPOINT,
      facebodyIP: ALIYUN_FACEBODY_IP,
      ossEndpoint: ALIYUN_OSS_ENDPOINT,
      ossBucket: ALIYUN_OSS_BUCKET,
      hasAccessKey: hasAliyunConfig(),
      results
    }
  }
}

exports.main = async (event) => {
  try {
    switch (event.action) {
      case 'analyzeImage':
      case 'analyzeVideo':
        return await analyzePose(event)
      case 'getLatest':
        return await getLatest()
      case 'listHistory':
        return await listHistory(event)
      case 'clearMine':
        return await clearMine()
      case 'getDetail':
        return await getDetail(event)
      case 'listStandards':
        return await listStandards()
      case 'initStandards':
        return await initStandards()
      case 'diagnoseNetwork':
        return await diagnoseNetwork()
      default:
        return {
          success: false,
          errMsg: `Unknown action: ${event.action}`
        }
    }
  } catch (error) {
    return {
      success: false,
      errMsg: error.message || 'poseService failed'
    }
  }
}
