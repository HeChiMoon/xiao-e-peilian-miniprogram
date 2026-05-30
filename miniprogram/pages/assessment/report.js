const { getAssessment } = require('../../utils/storage')
const { getCloudAssessmentReport } = require('../../services/assessmentService')

const map = {
  low: {
    levelText: '低风险',
    summary: '腿脚整体状态不错，关节灵活度、力量和稳定性都还可以。',
    suggestion: '建议每天散步 30 分钟，再完成 3 个每日练动作，训练后做做拉伸。',
    className: 'low'
  },
  medium: {
    levelText: '中风险',
    summary: '整体情况还不错，但有几项动作提示需要放慢节奏。',
    suggestion: '建议从低强度关卡开始，动作以慢、稳、无痛为准。',
    className: 'medium'
  },
  high: {
    levelText: '高风险',
    summary: '检测到较高风险。为了确保安全，建议先暂停训练，并尽快进行专业评估。',
    suggestion: '暂不建议进入动作训练，可先查看科普内容，并联系医生或康复师评估。',
    className: 'high'
  }
}

Page({
  data: {
    report: null
  },

  onLoad(query) {
    const cached = getAssessment()
    const level = query.level || (cached && cached.level) || 'low'
    const base = map[level] || map.low
    this.setData({
      report: {
        level,
        score: Number(query.score || (cached && cached.score) || 0),
        createdAt: (cached && cached.createdAt) || new Date().toLocaleDateString(),
        ...base
      }
    })
    this.loadCloudReport()
  },

  async loadCloudReport() {
    const cloudReport = await getCloudAssessmentReport()
    if (!cloudReport) {
      return
    }

    const base = map[cloudReport.level] || map.low
    this.setData({
      report: {
        ...base,
        ...cloudReport,
        className: cloudReport.className || base.className
      }
    })
  },

  goTraining() {
    wx.navigateTo({ url: '/pages/training/index' })
  },

  restart() {
    wx.redirectTo({ url: '/pages/assessment/index' })
  },

  backHome() {
    wx.switchTab({ url: '/pages/home/index' })
  }
})
