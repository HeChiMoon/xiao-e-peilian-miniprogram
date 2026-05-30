const { listPoseDetectionHistory } = require('../../services/poseService')

function formatTime(value) {
  if (!value) {
    return '刚刚'
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '最近记录'
  }

  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}月${day}日 ${hour}:${minute}`
}

function formatRecord(record) {
  const detected = Boolean(record && record.detected)
  const averageKnee = Number(record && record.angles && record.angles.averageKnee) || 0
  const score = Number(record && record.score) || 0

  return {
    ...record,
    angleText: detected && averageKnee > 0 ? `${averageKnee}°` : '这次未看清',
    scoreText: detected ? `${score}分` : '请再试一次',
    timeText: formatTime(record && record.createdAt),
    riskClass: record && record.riskLevel === 'high' ? 'danger' : record && record.riskLevel === 'middle' ? 'warning' : 'safe'
  }
}

function buildSummary(records) {
  const latest = Array.isArray(records) && records.length > 0 ? records[0] : null
  return {
    totalText: `${records.length} 次`,
    latestText: latest ? `${latest.actionName || '最近检测'} · ${latest.scoreText}` : '还没有检测记录'
  }
}

Page({
  data: {
    loading: false,
    records: [],
    totalText: '0 次',
    latestText: '还没有检测记录'
  },

  onShow() {
    this.loadHistory()
  },

  async loadHistory() {
    if (this.data.loading) {
      return Promise.resolve()
    }

    this.setData({ loading: true })
    const records = await listPoseDetectionHistory(30)
    const formatted = records.map(formatRecord)
    const summary = buildSummary(formatted)

    this.setData({
      records: formatted,
      loading: false,
      totalText: summary.totalText,
      latestText: summary.latestText
    })
  },

  openDetail(event) {
    const id = event.currentTarget.dataset.id
    if (!id) {
      return
    }
    wx.navigateTo({ url: `/pages/pose/detail?id=${id}` })
  },

  onPullDownRefresh() {
    this.loadHistory().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  goTraining() {
    wx.navigateTo({ url: '/pages/training/index' })
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/index' })
  }
})
