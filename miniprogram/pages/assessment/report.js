const { getAssessment } = require('../../utils/storage')
const { getCloudAssessmentReport } = require('../../services/assessmentService')

const LEVEL_MAP = {
  low: {
    levelText: '低风险',
    summary: '下肢功能整体较平稳，可以按正常顺序完成每日练。',
    suggestion: '今日可按靠墙静蹲、坐姿直腿抬高、单腿站立的顺序训练，仍以无痛和稳定为准。',
    className: 'low'
  },
  medium: {
    levelText: '中风险',
    summary: '有几项功能需要关注，建议先从坐姿和低强度动作开始。',
    suggestion: '今日建议先做坐姿直腿抬高，再做小角度靠墙静蹲，单腿站立必须扶稳。',
    className: 'medium'
  },
  high: {
    levelText: '高风险',
    summary: '筛查提示下肢功能风险较高，今天应把安全放在第一位。',
    suggestion: '如要训练，请只做轻量版动作，疼痛或不稳时马上停止。',
    className: 'high'
  }
}

const DIMENSION_META = [
  { key: 'pain', name: '疼痛', weight: 6, low: '疼痛信号少', medium: '疼痛需关注', high: '疼痛风险高' },
  { key: 'fallRisk', name: '跌倒', weight: 5, low: '跌倒风险低', medium: '有跌倒风险', high: '跌倒风险高' },
  { key: 'balance', name: '平衡', weight: 4, low: '平衡较稳定', medium: '平衡需扶稳', high: '平衡风险高' },
  { key: 'strength', name: '肌力', weight: 3, low: '坐站表现较好', medium: '肌力略弱', high: '肌力不足明显' },
  { key: 'mobility', name: '活动度', weight: 2, low: '伸膝较顺畅', medium: '伸膝需关注', high: '活动受限明显' },
  { key: 'dailyImpact', name: '生活影响', weight: 1, low: '影响较小', medium: '日常受影响', high: '影响较明显' }
]

const ACTION_NAMES = {
  1: '靠墙静蹲',
  2: '坐姿直腿抬高',
  3: '单腿站立'
}

function dimensionState(score) {
  if (score >= 5) return 'high'
  if (score >= 2) return 'medium'
  return 'low'
}

function dimensionRank(state) {
  if (state === 'high') return 3
  if (state === 'medium') return 2
  return 1
}

function dimensionPriorityText(state) {
  if (state === 'high') return '优先级高'
  if (state === 'medium') return '值得关注'
  return '保持观察'
}

function normalizeReport(report, query = {}) {
  const level = report && report.level ? report.level : query.level || 'low'
  const base = LEVEL_MAP[level] || LEVEL_MAP.low
  return {
    level,
    score: Number((report && report.score) || query.score || 0),
    createdAt: (report && report.createdAt) || new Date().toLocaleDateString(),
    ...base,
    ...(report || {}),
    className: (report && report.className) || base.className,
    levelText: (report && report.levelText) || base.levelText,
    summary: (report && report.summary) || base.summary,
    suggestion: (report && report.suggestion) || base.suggestion
  }
}

function buildDimensionCards(report) {
  const scores = report.dimensionScores || {}
  const states = report.dimensionStates || {}
  return DIMENSION_META.map((item) => {
    const score = Number(scores[item.key]) || 0
    const state = states[item.key] || dimensionState(score)
    return {
      key: item.key,
      name: item.name,
      score,
      state,
      stateText: state === 'high' ? '高' : state === 'medium' ? '中' : '低',
      priorityText: dimensionPriorityText(state),
      rank: dimensionRank(state),
      weight: item.weight,
      desc: item[state] || item.low
    }
  }).sort((a, b) => {
    if (b.rank !== a.rank) return b.rank - a.rank
    if (b.score !== a.score) return b.score - a.score
    return b.weight - a.weight
  })
}

function buildActionPlan(report) {
  const profile = report.recommendationProfile || {}
  const order = Array.isArray(profile.recommendedOrder) && profile.recommendedOrder.length
    ? profile.recommendedOrder
    : report.level === 'low' ? [1, 2, 3] : [2, 1, 3]
  const hints = profile.actionHints || {}
  return order.map((id, index) => ({
    id,
    index: index + 1,
    name: ACTION_NAMES[id] || '推荐动作',
    hint: hints[id] || '动作慢一点，以无痛和稳定为准。'
  }))
}

function prepareView(report) {
  const safetyFlags = report.safetyFlags || {}
  const blocked = Boolean(safetyFlags.blocked)
  return {
    report,
    dimensionCards: buildDimensionCards(report),
    actionPlan: blocked ? [] : buildActionPlan(report),
    safetyReasons: Array.isArray(safetyFlags.reasons) ? safetyFlags.reasons : [],
    canTrain: !blocked
  }
}

Page({
  data: {
    report: null,
    dimensionCards: [],
    actionPlan: [],
    safetyReasons: [],
    canTrain: true
  },

  onLoad(query) {
    const cached = getAssessment()
    this.setData(prepareView(normalizeReport(cached, query)))
    this.loadCloudReport()
  },

  async loadCloudReport() {
    const cloudReport = await getCloudAssessmentReport()
    if (!cloudReport) {
      return
    }

    this.setData(prepareView(normalizeReport(cloudReport)))
  },

  goTraining() {
    wx.navigateTo({ url: '/pages/training/index' })
  },

  goVideo() {
    wx.navigateTo({ url: '/pages/video/index' })
  },

  restart() {
    wx.redirectTo({ url: '/pages/assessment/index' })
  },

  backHome() {
    wx.switchTab({ url: '/pages/home/index' })
  }
})
