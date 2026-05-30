const { getTodayKey, getTrainingProgress, saveTrainingProgress, resetTrainingProgress } = require('../utils/storage')

const FUNCTION_NAME = 'trainingService'
const LEVEL_IDS = [1, 2, 3]

function canUseCloud() {
  return Boolean(wx.cloud && wx.cloud.callFunction)
}

function normalizeProgress(progress) {
  return {
    completedIds: Array.isArray(progress && progress.completedIds)
      ? progress.completedIds.map(Number).filter((id) => LEVEL_IDS.includes(id))
      : [],
    currentUnlocked: Number(progress && progress.currentUnlocked) || 1,
    progressDate: progress && progress.progressDate ? String(progress.progressDate) : getTodayKey()
  }
}

function buildLocalPlan(progress) {
  const safeProgress = normalizeProgress(progress || getTrainingProgress())
  const nextId = LEVEL_IDS.find((id) => safeProgress.completedIds.indexOf(id) < 0) || 1
  return {
    recommendedIds: [2, nextId, 1, 3].filter((id, index, arr) => arr.indexOf(id) === index && LEVEL_IDS.includes(id)),
    focusLevelId: Math.min(Math.max(safeProgress.currentUnlocked, 1), LEVEL_IDS.length),
    focusLevelName: '今日推荐',
    riskLevel: 'unknown',
    riskText: '先建立数据',
    headline: '今日建议先做低冲击热身',
    reason: '还没读取到完整云端数据，先按温和、安全的顺序训练。',
    safetyTips: ['动作慢一点，疼痛加重就停下', '旁边准备稳固椅子或墙面', '每次先热身，不追求一次做很多'],
    levelHints: {
      1: '背贴墙面，膝盖不要超过脚尖。',
      2: '膝盖尽量伸直，慢慢抬起再放下。',
      3: '扶稳椅背，站不稳就先缩短时间。'
    }
  }
}

function callTrainingService(action, data = {}) {
  if (!canUseCloud()) {
    return Promise.reject(new Error('当前基础库不支持微信云开发'))
  }

  return wx.cloud.callFunction({
    name: FUNCTION_NAME,
    data: {
      action,
      data
    }
  }).then((res) => {
    const result = res.result || {}
    if (!result.success) {
      throw new Error(result.errMsg || '云端训练服务调用失败')
    }
    return result.data
  })
}

function getCloudTrainingProgress() {
  if (!canUseCloud()) {
    return Promise.resolve(getTrainingProgress())
  }

  return callTrainingService('get', { dayKey: getTodayKey() }).then((data) => {
    const progress = normalizeProgress(data)
    saveTrainingProgress(progress)
    return progress
  }).catch((error) => {
    console.warn('读取云端训练进度失败，使用本地缓存', error)
    return getTrainingProgress()
  })
}

function getCloudTrainingPlan(progress) {
  const fallbackProgress = normalizeProgress(progress || getTrainingProgress())

  if (!canUseCloud()) {
    return Promise.resolve(buildLocalPlan(fallbackProgress))
  }

  return callTrainingService('getPlan', { dayKey: getTodayKey() }).then((plan) => {
    if (!plan || !Array.isArray(plan.recommendedIds)) {
      return buildLocalPlan(fallbackProgress)
    }
    return {
      ...buildLocalPlan(fallbackProgress),
      ...plan,
      recommendedIds: plan.recommendedIds.map(Number).filter((id) => LEVEL_IDS.includes(id)),
      focusLevelId: Number(plan.focusLevelId) || fallbackProgress.currentUnlocked,
      safetyTips: Array.isArray(plan.safetyTips) ? plan.safetyTips : [],
      levelHints: plan.levelHints || {}
    }
  }).catch((error) => {
    console.warn('读取云端个性化训练计划失败，使用本地推荐', error)
    return buildLocalPlan(fallbackProgress)
  })
}

function completeCloudLevel(id, total) {
  const safeTotal = Number(total) || LEVEL_IDS.length

  if (!canUseCloud()) {
    const localProgress = getTrainingProgress()
    const completedIds = Array.from(new Set(localProgress.completedIds.concat(Number(id)))).filter((levelId) => LEVEL_IDS.includes(levelId))
    const currentUnlocked = Math.min(Math.max(localProgress.currentUnlocked, Number(id) + 1), safeTotal)
    const next = saveTrainingProgress({
      completedIds,
      currentUnlocked,
      progressDate: getTodayKey()
    })
    return Promise.resolve(next)
  }

  return callTrainingService('completeLevel', {
    id,
    total: safeTotal,
    dayKey: getTodayKey()
  }).then((data) => {
    const progress = normalizeProgress(data)
    saveTrainingProgress(progress)
    return progress
  }).catch((error) => {
    console.warn('保存云端训练进度失败，使用本地缓存', error)
    const localProgress = getTrainingProgress()
    const completedIds = Array.from(new Set(localProgress.completedIds.concat(Number(id)))).filter((levelId) => LEVEL_IDS.includes(levelId))
    const currentUnlocked = Math.min(Math.max(localProgress.currentUnlocked, Number(id) + 1), safeTotal)
    const next = saveTrainingProgress({
      completedIds,
      currentUnlocked,
      progressDate: getTodayKey()
    })
    return next
  })
}

function resetCloudTrainingProgress() {
  const localReset = resetTrainingProgress()

  if (!canUseCloud()) {
    return Promise.resolve(localReset)
  }

  return callTrainingService('reset', { dayKey: getTodayKey() }).then((data) => {
    const progress = normalizeProgress(data)
    saveTrainingProgress(progress)
    return progress
  }).catch((error) => {
    console.warn('重置云端训练进度失败，已先重置本地缓存', error)
    return localReset
  })
}

module.exports = {
  getCloudTrainingProgress,
  getCloudTrainingPlan,
  completeCloudLevel,
  resetCloudTrainingProgress
}
