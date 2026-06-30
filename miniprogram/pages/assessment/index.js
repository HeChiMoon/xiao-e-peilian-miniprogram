const { assessmentSections } = require('../../data/mock')
const { saveAssessment } = require('../../utils/storage')
const { saveCloudAssessmentReport } = require('../../services/assessmentService')

const STAGES = ['intro', 'profile', 'health', 'mobility', 'strength', 'risk']

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function emptyTimer() {
  return {
    status: 'idle',
    elapsed: 0,
    value: null,
    unable: false,
    display: '0 秒'
  }
}

function formatTimerDisplay(timer, unableText) {
  if (timer.unable) return unableText
  const value = timer.value || timer.elapsed || 0
  return `${value} 秒`
}

function scorePainScale(value) {
  const score = Number(value) || 0
  if (score >= 6) return 6
  if (score >= 3) return 4
  if (score >= 1) return 1
  return 0
}

function scoreSitToStand(timer) {
  if (timer.unable) return 5
  const value = Number(timer.value) || 0
  if (!value) return 0
  return value > 12 ? 3 : 0
}

function scoreSingleLegStand(timer) {
  if (timer.unable) return 5
  const value = Number(timer.value) || 0
  if (!value) return 0
  if (value >= 20) return 0
  if (value >= 10) return 2
  return 4
}

function dimensionState(score) {
  if (score >= 5) return 'high'
  if (score >= 2) return 'medium'
  return 'low'
}

function levelFromScore(score, blocked) {
  if (blocked || score >= 12) {
    return {
      level: 'high',
      levelText: blocked ? '建议先专业评估' : '高风险',
      summary: blocked
        ? '有项目提示暂不适合自行完成动作训练。建议先咨询医生或康复师，再决定训练方式。'
        : '筛查提示下肢功能风险较高，今天应把安全放在第一位。',
      suggestion: blocked
        ? '暂不建议进入每日练。可以先查看科普内容，或让家人陪同咨询专业人员。'
        : '如要训练，请只做轻量版动作，疼痛或不稳时马上停止。'
    }
  }

  if (score >= 6) {
    return {
      level: 'medium',
      levelText: '中风险',
      summary: '有几项功能需要关注，建议先从坐姿和低强度动作开始。',
      suggestion: '今日建议先做坐姿直腿抬高，再做小角度靠墙静蹲，单腿站立必须扶稳。'
    }
  }

  return {
    level: 'low',
    levelText: '低风险',
    summary: '下肢功能整体较平稳，可以按正常顺序完成每日练。',
    suggestion: '今日可按靠墙静蹲、坐姿直腿抬高、单腿站立的顺序训练，仍以无痛和稳定为准。'
  }
}

function buildActionHints({ blocked, dimensions }) {
  const painHigh = dimensions.pain >= 4
  const mobilityWeak = dimensions.mobility >= 2
  const strengthWeak = dimensions.strength >= 3
  const balanceWeak = dimensions.balance >= 2 || dimensions.fallRisk >= 2

  if (blocked) {
    return {
      1: '暂不建议自行练习靠墙静蹲，先做专业评估。',
      2: '如需活动，只做轻柔伸膝，不要追求抬高。',
      3: '暂不建议自行做单腿站立。'
    }
  }

  return {
    1: painHigh || strengthWeak
      ? '今天只做小角度，背贴墙，膝盖不要超过脚尖。'
      : '按正常节奏做，保持膝盖朝向脚尖。',
    2: mobilityWeak
      ? '优先练这个，重点是慢慢伸直膝盖，不要借惯性。'
      : '慢起慢落，脚尖轻轻回勾。',
    3: balanceWeak
      ? '必须扶稳椅背，能站几秒算几秒。'
      : '扶椅完成，身体不要左右晃。'
  }
}

function buildRecommendationProfile({ level, blocked, dimensions, timers }) {
  let recommendedOrder = [1, 2, 3]
  if (blocked) {
    recommendedOrder = []
  } else if (level !== 'low' || dimensions.mobility >= 2 || dimensions.pain >= 4) {
    recommendedOrder = [2, 1, 3]
  }

  return {
    painStage: dimensions.pain >= 4 ? 'pain_attention' : dimensions.pain >= 1 ? 'sub_pain' : 'no_pain',
    mobilityStage: dimensions.mobility >= 4 ? 'extension_limited' : dimensions.mobility >= 2 ? 'extension_attention' : 'normal',
    strengthStage: timers.sitToStand.unable ? 'unable' : dimensions.strength >= 3 ? 'weak' : 'stable',
    balanceStage: timers.singleLegStand.unable ? 'unable' : dimensions.balance >= 4 ? 'high_risk' : dimensions.balance >= 2 ? 'attention' : 'stable',
    recommendedOrder,
    actionHints: buildActionHints({ blocked, dimensions })
  }
}

Page({
  data: {
    stage: 'intro',
    intro: assessmentSections.intro,
    profileFields: [],
    profileQuestions: [],
    healthQuestions: [],
    mobilityQuestions: [],
    mobilityReasons: [],
    riskQuestions: [],
    painScale: assessmentSections.painScale,
    timerTests: assessmentSections.timerTests,
    profileValues: {},
    painScore: 0,
    answerScores: {},
    answerDetails: {},
    timers: {
      sitToStand: emptyTimer(),
      singleLegStand: emptyTimer()
    },
    savingReport: false
  },

  onLoad() {
    this.resetAssessment()
  },

  onUnload() {
    this.clearActiveTimer()
  },

  onHide() {
    this.clearActiveTimer()
  },

  resetAssessment() {
    this.clearActiveTimer()
    const timerTests = assessmentSections.timerTests
    this.setData({
      stage: 'intro',
      profileFields: clone(assessmentSections.profileFields).map((item) => ({ ...item, value: '' })),
      profileQuestions: clone(assessmentSections.profileQuestions),
      healthQuestions: clone(assessmentSections.healthQuestions),
      mobilityQuestions: clone(assessmentSections.mobilityQuestions),
      mobilityReasons: clone(assessmentSections.mobilityReasons),
      riskQuestions: clone(assessmentSections.riskQuestions),
      profileValues: {},
      painScore: 0,
      answerScores: {},
      answerDetails: {},
      timers: {
        sitToStand: {
          ...emptyTimer(),
          display: formatTimerDisplay(emptyTimer(), timerTests.sitToStand.unableText)
        },
        singleLegStand: {
          ...emptyTimer(),
          display: formatTimerDisplay(emptyTimer(), timerTests.singleLegStand.unableText)
        }
      },
      savingReport: false
    })
  },

  startAssessment() {
    this.setData({ stage: 'profile' })
  },

  chooseOption(event) {
    const { section, qindex, oindex } = event.currentTarget.dataset
    const list = this.data[section]
    const question = list[qindex]
    const option = question.options[oindex]

    this.setData({
      [`${section}[${qindex}].selected`]: option.value,
      answerScores: {
        ...this.data.answerScores,
        [question.key]: option.score
      },
      answerDetails: {
        ...this.data.answerDetails,
        [question.key]: {
          value: option.value,
          label: option.label,
          score: option.score,
          dimension: question.dimension,
          block: Boolean(option.block),
          caution: Boolean(option.caution),
          reason: option.reason || ''
        }
      }
    })
  },

  onProfileInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    const field = this.data.profileFields[index]
    if (!field) return

    const value = event.detail.value
    this.setData({
      [`profileFields[${index}].value`]: value,
      [`profileValues.${field.key}`]: value
    })
  },

  onPainScaleChange(event) {
    const painScore = Number(event.detail.value) || 0
    this.setData({
      painScore,
      answerScores: {
        ...this.data.answerScores,
        painScore: scorePainScale(painScore)
      },
      answerDetails: {
        ...this.data.answerDetails,
        painScore: {
          value: painScore,
          label: `${painScore} 分`,
          score: scorePainScale(painScore),
          dimension: 'pain'
        }
      }
    })
  },

  toggleMobilityReason(event) {
    const index = Number(event.currentTarget.dataset.index)
    const current = this.data.mobilityReasons[index]
    if (!current) return

    this.setData({
      [`mobilityReasons[${index}].selected`]: !current.selected
    })
  },

  updateTimerDisplay(type) {
    const timer = this.data.timers[type]
    const unableText = this.data.timerTests[type].unableText
    this.setData({
      [`timers.${type}.display`]: formatTimerDisplay(timer, unableText)
    })
  },

  startTimer(event) {
    const type = event.currentTarget.dataset.type
    this.clearActiveTimer()

    const startedAt = Date.now()
    this.activeTimerType = type
    this.activeTimerStartedAt = startedAt
    this.timerInterval = setInterval(() => {
      const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
      this.setData({
        [`timers.${type}.elapsed`]: elapsed,
        [`timers.${type}.display`]: `${elapsed} 秒`
      })
    }, 500)

    this.setData({
      [`timers.${type}.status`]: 'running',
      [`timers.${type}.elapsed`]: 0,
      [`timers.${type}.value`]: null,
      [`timers.${type}.unable`]: false,
      [`timers.${type}.display`]: '0 秒'
    })
  },

  finishTimer(event) {
    const type = event.currentTarget.dataset.type
    const elapsed = this.activeTimerType === type
      ? Math.max(1, Math.round((Date.now() - this.activeTimerStartedAt) / 1000))
      : this.data.timers[type].elapsed

    this.clearActiveTimer()
    this.setData({
      [`timers.${type}.status`]: 'done',
      [`timers.${type}.elapsed`]: elapsed,
      [`timers.${type}.value`]: elapsed,
      [`timers.${type}.unable`]: false,
      [`timers.${type}.display`]: `${elapsed} 秒`
    })
  },

  markTimerUnable(event) {
    const type = event.currentTarget.dataset.type
    this.clearActiveTimer()
    this.setData({
      [`timers.${type}.status`]: 'done',
      [`timers.${type}.elapsed`]: 0,
      [`timers.${type}.value`]: null,
      [`timers.${type}.unable`]: true,
      [`timers.${type}.display`]: this.data.timerTests[type].unableText
    })
  },

  clearActiveTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
    this.activeTimerType = ''
    this.activeTimerStartedAt = 0
  },

  validateQuestions(section) {
    const list = this.data[section]
    const missing = list.some((item) => !item.selected)
    if (missing) {
      wx.showToast({ title: '请先完成本部分题目', icon: 'none' })
      return false
    }
    return true
  },

  validateProfile() {
    if (!this.validateQuestions('profileQuestions')) return false

    const missing = this.data.profileFields.some((item) => !String(item.value || '').trim())
    if (missing) {
      wx.showToast({ title: '请补充年龄、身高和体重', icon: 'none' })
      return false
    }
    return true
  },

  validateStrength() {
    const { sitToStand, singleLegStand } = this.data.timers
    if (sitToStand.status !== 'done' || singleLegStand.status !== 'done') {
      wx.showToast({ title: '请完成两个计时测试', icon: 'none' })
      return false
    }
    return true
  },

  nextStage() {
    const { stage } = this.data
    if (stage === 'profile' && !this.validateProfile()) return
    if (stage === 'health' && !this.validateQuestions('healthQuestions')) return
    if (stage === 'mobility' && !this.validateQuestions('mobilityQuestions')) return
    if (stage === 'strength' && !this.validateStrength()) return

    const index = STAGES.indexOf(stage)
    this.setData({ stage: STAGES[index + 1] || 'risk' })
  },

  prevStage() {
    const index = STAGES.indexOf(this.data.stage)
    this.setData({ stage: STAGES[Math.max(index - 1, 0)] || 'intro' })
  },

  buildReport() {
    const answerScores = this.data.answerScores
    const answerDetails = this.data.answerDetails
    const timers = this.data.timers
    const mobilityReasonCount = this.data.mobilityReasons.filter((item) => item.selected).length
    const painFrequency = answerDetails.painFrequency || {}
    const blockedReasons = Object.keys(answerDetails)
      .map((key) => answerDetails[key])
      .filter((item) => item && item.block)
      .map((item) => item.reason || item.label)

    if (Number(this.data.painScore) >= 3 && Number(painFrequency.score) >= 3) {
      blockedReasons.push('疼痛达到 3 分及以上，且近 3 个月疼痛、肿胀或僵硬较频繁。')
    }
    if (Number(this.data.painScore) >= 6) {
      blockedReasons.push('疼痛程度较高，不建议自行训练。')
    }

    const dimensionScores = {
      pain: Number(answerScores.painFrequency || 0) + Number(answerScores.painArea || 0) + Number(answerScores.treatment || 0) + scorePainScale(this.data.painScore),
      mobility: Number(answerScores.kneeExtension || 0) + Math.min(mobilityReasonCount, 2),
      strength: scoreSitToStand(timers.sitToStand),
      balance: scoreSingleLegStand(timers.singleLegStand),
      fallRisk: Number(answerScores.fall || 0),
      dailyImpact: Number(answerScores.dailyImpact || 0)
    }
    const score = [
      dimensionScores.pain,
      dimensionScores.mobility,
      dimensionScores.strength,
      dimensionScores.balance,
      dimensionScores.fallRisk,
      dimensionScores.dailyImpact
    ].reduce((sum, item) => sum + Number(item || 0), 0) + Number(answerScores.walkingAid || 0) + Number(answerScores.recentSurgery || 0)
    const blocked = blockedReasons.length > 0
    const result = levelFromScore(score, blocked)
    const recommendationProfile = buildRecommendationProfile({
      level: result.level,
      blocked,
      dimensions: dimensionScores,
      timers
    })

    return {
      score,
      ...result,
      createdAt: new Date().toLocaleDateString(),
      answers: {
        profile: this.data.profileValues,
        selected: answerDetails,
        mobilityReasons: this.data.mobilityReasons.filter((item) => item.selected).map((item) => item.key),
        timers
      },
      dimensionScores,
      dimensionStates: {
        pain: dimensionState(dimensionScores.pain),
        mobility: dimensionState(dimensionScores.mobility),
        strength: dimensionState(dimensionScores.strength),
        balance: dimensionState(dimensionScores.balance),
        fallRisk: dimensionState(dimensionScores.fallRisk),
        dailyImpact: dimensionState(dimensionScores.dailyImpact)
      },
      safetyFlags: {
        blocked,
        reasons: blockedReasons
      },
      recommendationProfile
    }
  },

  async submitAssessment() {
    if (this.data.savingReport) return
    if (!this.validateQuestions('riskQuestions')) return

    const report = this.buildReport()
    this.setData({ savingReport: true })
    saveAssessment(report)
    try {
      await saveCloudAssessmentReport(report)
    } catch (error) {
      console.warn('保存云端筛查报告失败', error)
    }
    this.setData({ savingReport: false })
    wx.redirectTo({
      url: `/pages/assessment/report?level=${report.level}&score=${report.score}`
    })
  }
})
