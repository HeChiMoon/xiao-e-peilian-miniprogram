const { assessmentSections } = require('../../data/mock')
const { saveAssessment } = require('../../utils/storage')
const { saveCloudAssessmentReport } = require('../../services/assessmentService')

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function levelFromScore(score) {
  if (score >= 8) {
    return {
      level: 'high',
      levelText: '高风险',
      summary: '检测到较高风险。为了确保安全，建议先暂停训练，并尽快进行专业评估。',
      suggestion: '暂不建议进入动作训练，可先查看科普内容，并联系医生或康复师评估。'
    }
  }
  if (score >= 4) {
    return {
      level: 'medium',
      levelText: '中风险',
      summary: '整体情况还不错，但有几项动作提示需要放慢节奏。',
      suggestion: '建议从低强度关卡开始，动作以慢、稳、无痛为准。'
    }
  }
  return {
    level: 'low',
    levelText: '低风险',
    summary: '腿脚整体状态不错，关节灵活度、力量和稳定性都还可以。',
    suggestion: '建议每天散步 30 分钟，再完成 3 个每日练动作，训练后做做拉伸。'
  }
}

function getActionPreview(actionKey) {
  const map = {
    legShape: '/assets/images/xiao-e/mascot.png',
    squat: '/assets/images/xiao-e/ok.jpg',
    legRaise: '/assets/images/action-leg-raise.jpg',
    balance: '/assets/images/xiao-e/report.png',
    ligament: '/assets/images/xiao-e/detect.png',
    stride: '/assets/images/xiao-e/happy.png',
    jump: '/assets/images/xiao-e/confused.jpg'
  }

  return map[actionKey] || '/assets/images/xiao-e/mascot.png'
}

Page({
  data: {
    stage: 'intro',
    intro: assessmentSections.intro,
    basicQuestions: [],
    actionTests: [],
    riskQuestions: [],
    currentAction: null,
    showActionModal: false,
    actionImage: '/assets/images/action-leg-raise.jpg',
    answerScores: {},
    savingReport: false
  },

  onLoad() {
    this.resetAssessment()
  },

  resetAssessment() {
    this.setData({
      stage: 'intro',
      basicQuestions: clone(assessmentSections.basicQuestions),
      actionTests: clone(assessmentSections.actionTests),
      riskQuestions: clone(assessmentSections.riskQuestions),
      currentAction: null,
      showActionModal: false,
      answerScores: {}
    })
  },

  startAssessment() {
    this.setData({ stage: 'basic' })
  },

  chooseOption(event) {
    const { section, qindex, oindex } = event.currentTarget.dataset
    const list = this.data[section]
    const question = list[qindex]
    const option = question.options[oindex]
    const answerScores = {
      ...this.data.answerScores,
      [question.key]: option.score
    }

    this.setData({
      [`${section}[${qindex}].selected`]: option.value,
      answerScores
    })

    if (option.stop) {
      wx.showModal({
        title: '请先暂停测评',
        content: '检测到您疼痛较重。为了确保安全，测评先停止，请尽快就医评估，不要勉强继续运动。',
        showCancel: false,
        confirmText: '回首页',
        success: () => {
          wx.switchTab({ url: '/pages/home/index' })
        }
      })
    }
  },

  validateSection(section) {
    const list = this.data[section]
    const missing = list.some((item) => !item.selected)
    if (missing) {
      wx.showToast({ title: '请先完成本部分题目', icon: 'none' })
      return false
    }
    return true
  },

  nextFromBasic() {
    if (this.validateSection('basicQuestions')) {
      this.setData({ stage: 'actions' })
    }
  },

  nextFromActions() {
    if (this.validateSection('actionTests')) {
      this.setData({ stage: 'risk' })
    }
  },

  prevStage() {
    const map = {
      basic: 'intro',
      actions: 'basic',
      risk: 'actions'
    }
    this.setData({ stage: map[this.data.stage] || 'intro' })
  },

  openActionGuide(event) {
    const index = event.currentTarget.dataset.index
    const currentAction = this.data.actionTests[index]
    this.setData({
      currentAction,
      showActionModal: true,
      actionImage: getActionPreview(currentAction && currentAction.key)
    })
  },

  closeActionGuide() {
    this.setData({
      showActionModal: false,
      currentAction: null
    })
  },

  noop() {},

  async submitAssessment() {
    if (this.data.savingReport) {
      return
    }

    if (!this.validateSection('riskQuestions')) {
      return
    }

    const score = Object.values(this.data.answerScores).reduce((sum, item) => sum + Number(item || 0), 0)
    const result = levelFromScore(score)
    const report = {
      score,
      ...result,
      createdAt: new Date().toLocaleDateString(),
      answers: this.data.answerScores
    }

    this.setData({ savingReport: true })
    saveAssessment(report)
    await saveCloudAssessmentReport(report)
    this.setData({ savingReport: false })
    wx.redirectTo({
      url: `/pages/assessment/report?level=${report.level}&score=${report.score}`
    })
  }
})
