const { profile } = require('../../data/mock')
const { getAssessment, getElderProfile } = require('../../utils/storage')
const { getCloudElderProfile } = require('../../services/elderService')
const { getCloudAssessmentReport } = require('../../services/assessmentService')
const { getLatestPoseDetection } = require('../../services/poseService')

function formatPoseRecord(record) {
  if (!record) {
    return {
      hasPose: false,
      actionName: '暂未检测',
      angleText: '暂未检测',
      scoreText: '暂未检测',
      riskText: '等待检测',
      suggestion: '完成一次动作检测后，这里会展示角度、评分和训练建议。'
    }
  }

  return {
    hasPose: true,
    actionName: record.actionName || '最近动作检测',
    angleText: record.angles ? `${record.angles.averageKnee || 0}°` : '暂无',
    scoreText: `${record.score || 0}分`,
    riskText: record.riskText || '已检测',
    suggestion: record.suggestion || '请结合自身感受，保持低强度、慢节奏训练。'
  }
}

function buildProfileSummary(currentProfile, reportText) {
  return [
    currentProfile.healthLevel ? `健康等级：${currentProfile.healthLevel}` : '',
    reportText && reportText !== '未测评' ? `最近测评：${reportText}` : ''
  ].filter(Boolean).join(' · ')
}

Page({
  data: {
    profile,
    reportText: '未测评',
    profileSummary: buildProfileSummary(profile, '未测评'),
    poseRecord: formatPoseRecord(null)
  },

  onShow() {
    const report = getAssessment()
    const localProfile = getElderProfile(profile)
    const reportText = report ? `${report.levelText} · ${report.score}分` : '未测评'

    this.setData({
      profile: localProfile,
      reportText,
      profileSummary: buildProfileSummary(localProfile, reportText)
    })

    this.loadCloudProfile()
    this.loadCloudAssessment()
    this.loadLatestPose()
  },

  async loadCloudProfile() {
    const cloudProfile = await getCloudElderProfile(profile)
    this.setData({
      profile: cloudProfile,
      profileSummary: buildProfileSummary(cloudProfile, this.data.reportText)
    })
  },

  async loadCloudAssessment() {
    const report = await getCloudAssessmentReport()
    const reportText = report ? `${report.levelText} · ${report.score}分` : '未测评'
    this.setData({
      reportText,
      profileSummary: buildProfileSummary(this.data.profile, reportText)
    })
  },

  async loadLatestPose() {
    const record = await getLatestPoseDetection()
    this.setData({
      poseRecord: formatPoseRecord(record)
    })
  },

  goPoseHistory() {
    wx.navigateTo({ url: '/pages/pose/history' })
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/index' })
  }
})
