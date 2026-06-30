const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const progressCollection = db.collection('training_progress')
const elders = db.collection('elders')
const assessments = db.collection('assessment_reports')
const poseRecords = db.collection('pose_detection_records')

const LEVEL_IDS = [1, 2, 3]
const LEVEL_NAMES = {
  1: '靠墙静蹲',
  2: '直腿抬高',
  3: '单腿站立'
}

function normalizeProgress(progress = {}, dayKey = '') {
  const safeDayKey = String(dayKey || '')
  const progressDate = String(progress.progressDate || '')

  if (!safeDayKey || progressDate !== safeDayKey) {
    return {
      completedIds: [],
      currentUnlocked: 1,
      progressDate: safeDayKey || progressDate || ''
    }
  }

  return {
    completedIds: Array.isArray(progress.completedIds)
      ? Array.from(new Set(progress.completedIds.map(Number).filter((id) => LEVEL_IDS.includes(id))))
      : [],
    currentUnlocked: Number(progress.currentUnlocked) || 1,
    progressDate: safeDayKey
  }
}

function includesAny(value, keywords) {
  const text = String(value || '')
  return keywords.some((keyword) => text.includes(keyword))
}

function uniqueIds(ids) {
  return ids
    .map(Number)
    .filter((id, index, arr) => LEVEL_IDS.includes(id) && arr.indexOf(id) === index)
}

function getReportRisk(report) {
  if (!report) return 'unknown'
  if (report.safetyFlags && report.safetyFlags.blocked) return 'high'

  const level = String(report.level || report.levelText || '').toLowerCase()
  const score = Number(report.score) || 0
  if (level.includes('high') || level.includes('高') || level.includes('专业评估') || score >= 12) return 'high'
  if (level.includes('middle') || level.includes('medium') || level.includes('中') || level.includes('关注') || score >= 6) return 'middle'
  return 'low'
}

function getPoseRisk(pose) {
  if (!pose) return 'unknown'
  if (pose.riskLevel === 'high') return 'high'
  if (pose.riskLevel === 'middle' || pose.riskLevel === 'medium') return 'middle'
  return 'low'
}

function mergeRisk(reportRisk, poseRisk, elder) {
  const profileText = [
    elder && elder.healthLevel,
    elder && elder.medicalHistory,
    elder && elder.painAreas,
    elder && elder.note
  ].join(' ')
  const painSignal = includesAny(profileText, ['疼', '痛', '肿', '僵', '关节', '活动受限', '摔倒'])

  if (reportRisk === 'high' || poseRisk === 'high' || (painSignal && reportRisk === 'middle')) return 'high'
  if (reportRisk === 'middle' || poseRisk === 'middle' || painSignal) return 'middle'
  if (reportRisk === 'unknown' && poseRisk === 'unknown') return 'unknown'
  return 'low'
}

function getAssessmentOrder(report, riskLevel) {
  const profile = report && report.recommendationProfile
  if (profile && Array.isArray(profile.recommendedOrder) && profile.recommendedOrder.length > 0) {
    return uniqueIds(profile.recommendedOrder.concat(LEVEL_IDS))
  }

  if (riskLevel === 'high' || riskLevel === 'middle' || riskLevel === 'unknown') {
    return [2, 1, 3]
  }
  return [1, 2, 3]
}

function buildRecommendedOrder(riskLevel, progress, pose, report) {
  let baseOrder = getAssessmentOrder(report, riskLevel)

  if (riskLevel === 'low') {
    const start = Math.min(Math.max(progress.currentUnlocked, 1), LEVEL_IDS.length)
    const progressOrder = LEVEL_IDS.slice(start - 1).concat(LEVEL_IDS.slice(0, start - 1))
    baseOrder = uniqueIds(baseOrder.concat(progressOrder))
  }

  const actionToLevel = {
    wallSquat: 1,
    legRaise: 2,
    straightLegRaise: 2,
    singleLegStand: 3
  }
  const poseLevel = pose && actionToLevel[pose.actionKey]
  if (poseLevel && (pose.riskLevel === 'high' || pose.riskLevel === 'middle')) {
    baseOrder = uniqueIds([2, poseLevel, 1, 3].concat(baseOrder))
  }

  return uniqueIds(baseOrder.concat(LEVEL_IDS))
}

function chooseFocusLevel(recommendedIds, progress) {
  const completed = progress.completedIds || []
  const unlocked = Number(progress.currentUnlocked) || 1
  const available = recommendedIds.find((id) => id <= unlocked && completed.indexOf(id) < 0)
  if (available) return available
  return recommendedIds.find((id) => completed.indexOf(id) < 0) || recommendedIds[0] || 1
}

function buildReason(riskLevel, elder, report, pose, progress) {
  const parts = []

  if (report) {
    parts.push(`最近筛查为${report.levelText || report.level || '已完成'}，分数 ${Number(report.score) || 0} 分`)
  }
  if (pose) {
    parts.push(`最近${pose.actionName || '姿势检测'}评分 ${Number(pose.score) || 0} 分`)
  }
  if (elder && (elder.painAreas || elder.medicalHistory)) {
    parts.push('已结合病史和疼痛部位')
  }
  if (progress.completedIds && progress.completedIds.length > 0) {
    parts.push(`今日已完成 ${progress.completedIds.length} 个动作`)
  }

  if (parts.length === 0) {
    return '当前还缺少筛查和检测记录，先按低冲击、容易完成的顺序开始，边练边建立个人数据。'
  }

  const prefix = riskLevel === 'high'
    ? '今天建议把安全放在第一位。'
    : riskLevel === 'middle'
      ? '今天建议先做温和激活，再进入力量训练。'
      : '今天状态适合循序推进。'

  return `${prefix}${parts.join('；')}。`
}

function buildSafetyTips(riskLevel, pose, report) {
  const tips = ['动作慢一点，疼痛加重就停下', '旁边准备稳固椅子或墙面', '每次先热身，不追求一次做很多']
  const blocked = Boolean(report && report.safetyFlags && report.safetyFlags.blocked)

  if (blocked) {
    return ['筛查提示暂不建议自行训练', '可以先看科普视频或咨询专业人员', '如有疼痛、肿胀或近期手术，请先听医生意见']
  }
  if (riskLevel === 'high') {
    return ['优先完成直腿抬高', '靠墙静蹲和单腿站立先降低幅度', '如果出现明显肿胀或刺痛，先休息并考虑就医']
  }
  if (riskLevel === 'middle') {
    return tips.concat('先完成推荐动作，再看体力决定是否继续')
  }
  if (pose && pose.riskLevel === 'middle') {
    return tips.concat(`最近${pose.actionName || '检测动作'}还可以再放慢一点`)
  }
  return tips
}

function buildLevelHints(riskLevel, pose, report) {
  const profileHints = report && report.recommendationProfile && report.recommendationProfile.actionHints
    ? report.recommendationProfile.actionHints
    : {}
  const hints = {
    1: profileHints[1] || '背贴墙面，膝盖不要超过脚尖，先做小幅度。',
    2: profileHints[2] || '膝盖尽量伸直，抬起和放下都要慢。',
    3: profileHints[3] || '一定扶稳椅背，脚轻轻离地即可。'
  }

  if (riskLevel === 'high') {
    hints[1] = profileHints[1] || '今天只做轻量版，蹲得浅一点也可以。'
    hints[3] = profileHints[3] || '如果不稳，先在家人看护下尝试。'
  }

  if (pose && pose.actionKey === 'wallSquat') {
    hints[1] = '最近静蹲检测需要关注，先缩小下蹲幅度，保持膝盖朝向脚尖。'
  }
  if (pose && (pose.actionKey === 'legRaise' || pose.actionKey === 'straightLegRaise')) {
    hints[2] = '最近抬腿检测需要关注，重点是膝盖伸直，不要靠惯性甩腿。'
  }
  if (pose && pose.actionKey === 'singleLegStand') {
    hints[3] = '最近平衡检测需要关注，必须扶稳，时间短一点也没关系。'
  }

  return hints
}

async function getCurrentRecord(openid) {
  return progressCollection.where({ ownerOpenId: openid }).limit(1).get()
}

async function getLatestByOwner(collection, openid, orderField = 'createdAt') {
  return collection
    .where({ ownerOpenId: openid })
    .orderBy(orderField, 'desc')
    .limit(1)
    .get()
    .then((result) => result.data[0] || null)
}

async function get(event) {
  const { OPENID } = cloud.getWXContext()
  const dayKey = String(event.data && event.data.dayKey || '')
  const result = await getCurrentRecord(OPENID)
  if (result.data.length === 0) {
    return {
      success: true,
      data: normalizeProgress({}, dayKey)
    }
  }

  return {
    success: true,
    data: normalizeProgress(result.data[0], dayKey)
  }
}

async function getPlan(event) {
  const { OPENID } = cloud.getWXContext()
  const dayKey = String(event.data && event.data.dayKey || '')
  const progressResult = await getCurrentRecord(OPENID)
  const progress = progressResult.data.length > 0
    ? normalizeProgress(progressResult.data[0], dayKey)
    : normalizeProgress({}, dayKey)
  const elder = await getLatestByOwner(elders, OPENID, 'updatedAt')
  const report = await getLatestByOwner(assessments, OPENID, 'updatedAt')
  const pose = await getLatestByOwner(poseRecords, OPENID, 'createdAt')

  const riskLevel = mergeRisk(getReportRisk(report), getPoseRisk(pose), elder)
  const recommendedIds = buildRecommendedOrder(riskLevel, progress, pose, report)
  const focusLevelId = chooseFocusLevel(recommendedIds, progress)

  return {
    success: true,
    data: {
      recommendedIds,
      focusLevelId,
      focusLevelName: LEVEL_NAMES[focusLevelId] || '今日推荐',
      riskLevel,
      riskText: riskLevel === 'high' ? '偏谨慎' : riskLevel === 'middle' ? '稳步训练' : riskLevel === 'unknown' ? '先建立数据' : '循序推进',
      headline: `今日建议先做${LEVEL_NAMES[focusLevelId] || '推荐动作'}`,
      reason: buildReason(riskLevel, elder, report, pose, progress),
      safetyTips: buildSafetyTips(riskLevel, pose, report),
      levelHints: buildLevelHints(riskLevel, pose, report),
      basis: {
        hasElderProfile: Boolean(elder),
        hasAssessment: Boolean(report),
        hasPoseRecord: Boolean(pose),
        completedCount: progress.completedIds.length,
        assessmentBlocked: Boolean(report && report.safetyFlags && report.safetyFlags.blocked)
      }
    }
  }
}

async function completeLevel(event) {
  const { OPENID } = cloud.getWXContext()
  const id = Number(event.data && event.data.id)
  const total = Number(event.data && event.data.total) || LEVEL_IDS.length
  const dayKey = String(event.data && event.data.dayKey || '')
  const existing = await getCurrentRecord(OPENID)
  const base = existing.data.length > 0 ? normalizeProgress(existing.data[0], dayKey) : normalizeProgress({}, dayKey)
  const completedIds = Array.from(new Set(base.completedIds.concat(id))).filter((levelId) => LEVEL_IDS.includes(levelId))
  const currentUnlocked = Math.min(Math.max(base.currentUnlocked, id + 1), total)
  const next = {
    completedIds,
    currentUnlocked,
    progressDate: dayKey,
    ownerOpenId: OPENID,
    updatedAt: db.serverDate()
  }

  if (existing.data.length > 0) {
    await progressCollection.doc(existing.data[0]._id).update({ data: next })
  } else {
    await progressCollection.add({
      data: {
        ...next,
        createdAt: db.serverDate()
      }
    })
  }

  return {
    success: true,
    data: {
      completedIds,
      currentUnlocked,
      progressDate: dayKey
    }
  }
}

async function reset(event) {
  const { OPENID } = cloud.getWXContext()
  const dayKey = String(event.data && event.data.dayKey || '')
  const existing = await getCurrentRecord(OPENID)
  const next = {
    completedIds: [],
    currentUnlocked: 1,
    progressDate: dayKey,
    ownerOpenId: OPENID,
    updatedAt: db.serverDate()
  }

  if (existing.data.length > 0) {
    await progressCollection.doc(existing.data[0]._id).update({ data: next })
  } else {
    await progressCollection.add({
      data: {
        ...next,
        createdAt: db.serverDate()
      }
    })
  }

  return {
    success: true,
    data: {
      completedIds: [],
      currentUnlocked: 1,
      progressDate: dayKey
    }
  }
}

exports.main = async (event) => {
  try {
    switch (event.action) {
      case 'get':
        return await get(event)
      case 'getPlan':
        return await getPlan(event)
      case 'completeLevel':
        return await completeLevel(event)
      case 'reset':
        return await reset(event)
      default:
        return {
          success: false,
          errMsg: `Unknown action: ${event.action}`
        }
    }
  } catch (error) {
    return {
      success: false,
      errMsg: error.message || 'trainingService failed'
    }
  }
}
