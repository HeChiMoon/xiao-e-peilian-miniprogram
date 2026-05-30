const { videoItems } = require('../../data/mock')
const { getTrainingProgress, getAssessment, getElderProfile } = require('../../utils/storage')
const { getCloudElderProfile } = require('../../services/elderService')
const { getCloudAssessmentReport } = require('../../services/assessmentService')
const { getCloudTrainingProgress } = require('../../services/trainingService')
const { getLatestPoseDetection } = require('../../services/poseService')
const { getRecommendedVideoPreview } = require('../../utils/recommendation')

const DEFAULT_PROFILE = {
  name: '',
  age: '',
  healthLevel: '待完善',
  avatar: '/assets/images/goose-main.png'
}

function buildVideoPreview(context) {
  const video = getRecommendedVideoPreview(videoItems, context)
  if (!video) {
    return {
      title: '膝关节日常保护小知识',
      reason: '适合先了解日常保护和动作注意事项。'
    }
  }

  return {
    title: video.title,
    reason: video.recommendReason || '结合当前状态推荐优先观看。'
  }
}

function buildGreeting(profile) {
  if (profile && profile.name) {
    return `您好，${profile.name}`
  }
  return '您好'
}

function buildPoseText(pose) {
  if (!pose) {
    return '还未检测'
  }
  return `${pose.actionName || '最近检测'} · ${Number(pose.score) || 0}分`
}

function buildDailyFocus(context) {
  const profile = context.profile || {}
  const report = context.report || null
  const progress = context.progress || { completedIds: [] }
  const pose = context.pose || null
  const completedCount = Array.isArray(progress.completedIds) ? progress.completedIds.length : 0

  if (completedCount === 0) {
    return {
      title: '今天先慢慢热起来',
      copy: '建议先完成一次测评，再从每日练的第一个动作开始。'
    }
  }

  if (pose && pose.riskLevel === 'high') {
    return {
      title: '今天动作放轻一点',
      copy: pose.suggestion || '先做轻量动作，出现明显疼痛就及时停下。'
    }
  }

  if (report && (String(report.level).includes('high') || String(report.levelText).includes('高'))) {
    return {
      title: '今天以安全为先',
      copy: report.suggestion || '建议先看科普视频，再做低强度训练。'
    }
  }

  if (profile.profileComplete === false) {
    return {
      title: '资料已保存，可继续完善',
      copy: '补充病史、疼痛部位和紧急联系人后，推荐会更贴合。'
    }
  }

  return {
    title: '今天状态不错，继续保持',
    copy: completedCount >= 3
      ? '今天的训练已经完成，可以看一看科普视频，顺便做做放松。'
      : '继续完成每日练，动作慢一点、稳一点就很好。'
  }
}

Page({
  data: {
    profile: DEFAULT_PROFILE,
    greeting: buildGreeting(DEFAULT_PROFILE),
    progressText: '0/3',
    reportText: '还未测评',
    poseText: '还未检测',
    mascot: '/assets/images/goose-main.png',
    recommendedVideo: buildVideoPreview({}),
    dailyFocus: buildDailyFocus({})
  },

  onShow() {
    const progress = getTrainingProgress()
    const report = getAssessment()
    const localProfile = getElderProfile(DEFAULT_PROFILE)
    const localContext = {
      profile: localProfile,
      report,
      progress,
      pose: null
    }

    this.setData({
      profile: localProfile,
      greeting: buildGreeting(localProfile),
      progressText: `${progress.completedIds.length}/3`,
      reportText: report ? `${report.levelText} · ${report.score}分` : '还未测评',
      poseText: '还未检测',
      recommendedVideo: buildVideoPreview(localContext),
      dailyFocus: buildDailyFocus(localContext)
    })

    this.loadCloudProfile()
    this.loadCloudAssessment()
    this.loadHomeRecommendation()
  },

  async loadCloudProfile() {
    const cloudProfile = await getCloudElderProfile(DEFAULT_PROFILE)
    this.setData({
      profile: cloudProfile,
      greeting: buildGreeting(cloudProfile)
    })

    if (cloudProfile.profileComplete === false && !this.profileTipShown) {
      this.profileTipShown = true
      wx.showToast({
        title: '资料已保存，可继续完善',
        icon: 'none'
      })
    }
  },

  async loadCloudAssessment() {
    const report = await getCloudAssessmentReport()
    this.setData({
      reportText: report ? `${report.levelText} · ${report.score}分` : '还未测评'
    })
  },

  async loadHomeRecommendation() {
    const results = await Promise.all([
      getCloudElderProfile(DEFAULT_PROFILE),
      getCloudAssessmentReport(),
      getCloudTrainingProgress(),
      getLatestPoseDetection()
    ])

    const context = {
      profile: results[0] || this.data.profile,
      report: results[1] || getAssessment(),
      progress: results[2] || getTrainingProgress(),
      pose: results[3] || null
    }

    this.setData({
      poseText: buildPoseText(context.pose),
      recommendedVideo: buildVideoPreview(context),
      dailyFocus: buildDailyFocus(context)
    })
  },

  goAssessment() {
    wx.navigateTo({ url: '/pages/assessment/index' })
  },

  goTraining() {
    wx.navigateTo({ url: '/pages/training/index' })
  },

  goVideo() {
    wx.navigateTo({ url: '/pages/video/index' })
  },

  goChat() {
    wx.navigateTo({ url: '/pages/chat/index' })
  }
})
