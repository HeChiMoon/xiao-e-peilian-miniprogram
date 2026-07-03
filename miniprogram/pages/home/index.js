const { videoItems } = require('../../data/mock')
const { getTrainingProgress, getAssessment, getElderProfile } = require('../../utils/storage')
const { getCloudElderProfile } = require('../../services/elderService')
const { getCloudAssessmentReport } = require('../../services/assessmentService')
const { getCloudTrainingProgress } = require('../../services/trainingService')
const { getLatestPoseDetection } = require('../../services/poseService')
const { getRecommendedVideoPreview } = require('../../utils/recommendation')
const { enableShareMenu, buildShareMessage, buildTimelineShare } = require('../../utils/share')

const DEFAULT_PROFILE = {
  name: '',
  age: '',
  healthLevel: '待完善',
  avatar: '/assets/images/xiao-e-icons/role-elder.png'
}

const XIAO_E_ASSETS = {
  mascot: '/assets/images/xiao-e-icons/voice-assistant.png',
  detect: '/assets/images/xiao-e-icons/pose-history.png',
  report: '/assets/images/xiao-e-icons/health-archive.png',
  video: '/assets/images/xiao-e-icons/knowledge.png'
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
    reason: video.recommendReason || '结合当前状态，建议优先看看这条。'
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
      copy: report.suggestion || '建议先看健康知识，再做低强度训练。'
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
      ? '今天的训练已经完成，可以看看健康知识，顺便做做放松。'
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
    mascot: XIAO_E_ASSETS.mascot,
    featureIcons: XIAO_E_ASSETS,
    recommendedVideo: buildVideoPreview({}),
    dailyFocus: buildDailyFocus({})
  },

  onLoad() {
    enableShareMenu()
  },

  onShow() {
    let progress = { completedIds: [], currentUnlocked: 1 }
    let report = null
    let localProfile = DEFAULT_PROFILE

    try {
      progress = getTrainingProgress()
      report = getAssessment()
      localProfile = getElderProfile(DEFAULT_PROFILE)
    } catch (error) {
      console.warn('首页读取本地数据失败，使用默认内容', error)
    }

    const completedIds = Array.isArray(progress.completedIds) ? progress.completedIds : []
    const localContext = {
      profile: localProfile,
      report,
      progress: {
        ...progress,
        completedIds
      },
      pose: null
    }

    this.setData({
      profile: localProfile,
      greeting: buildGreeting(localProfile),
      progressText: `${completedIds.length}/3`,
      reportText: report ? `${report.levelText} · ${report.score}分` : '还未测评',
      poseText: '还未检测',
      recommendedVideo: buildVideoPreview(localContext),
      dailyFocus: buildDailyFocus(localContext)
    })

    this.loadCloudProfile().catch((error) => {
      console.warn('首页云端资料刷新失败', error)
    })
    this.loadCloudAssessment().catch((error) => {
      console.warn('首页云端测评刷新失败', error)
    })
    this.loadHomeRecommendation().catch((error) => {
      console.warn('首页推荐刷新失败', error)
    })
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
    const results = await Promise.allSettled([
      getCloudElderProfile(DEFAULT_PROFILE),
      getCloudAssessmentReport(),
      getCloudTrainingProgress(),
      getLatestPoseDetection()
    ])

    const values = results.map((result) => result.status === 'fulfilled' ? result.value : null)

    const context = {
      profile: values[0] || this.data.profile,
      report: values[1] || getAssessment(),
      progress: values[2] || getTrainingProgress(),
      pose: values[3] || null
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
    wx.navigateTo({ url: '/pages/knowledge/index' })
  },

  goChat() {
    wx.navigateTo({ url: '/pages/chat/index' })
  },

  onShareAppMessage() {
    return buildShareMessage({
      title: '\u8d77\u6b65\u8f7b\u76c8\uff1a\u6bcf\u65e5\u819d\u5173\u8282\u8bad\u7ec3\u966a\u4f34',
      path: '/pages/role/index'
    })
  },

  onShareTimeline() {
    return buildTimelineShare({
      title: '\u8d77\u6b65\u8f7b\u76c8\uff1a\u9002\u8001\u5316\u819d\u5173\u8282\u8bad\u7ec3\u966a\u4f34'
    })
  }
})
