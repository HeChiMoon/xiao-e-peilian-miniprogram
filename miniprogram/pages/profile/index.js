const { settings: defaultSettings } = require('../../data/mock')
const {
  getAssessment,
  getTrainingProgress,
  getSettings,
  saveSettings,
  getElderProfile,
  clearCurrentRole,
  clearDemoLocalData
} = require('../../utils/storage')
const { getCloudElderProfile, deleteCloudElderProfile } = require('../../services/elderService')
const { getCloudAssessmentReport, clearCloudAssessmentReport } = require('../../services/assessmentService')
const { createCaregiverBinding, getLatestCaregiverBinding, getOwnerBindingStatus, clearCaregiverBindings } = require('../../services/bindingService')
const { getLatestPoseDetection, clearPoseDetectionHistory } = require('../../services/poseService')
const { resetCloudTrainingProgress } = require('../../services/trainingService')

const DEFAULT_PROFILE = {
  name: '未命名用户',
  age: '',
  healthLevel: '待完善',
  avatar: '/assets/images/goose-main.png'
}

function buildPoseText(record) {
  if (!record) {
    return '还未检测'
  }
  return `${record.actionName || '最近检测'} · ${Number(record.score) || 0}分`
}

function buildBindingText(binding) {
  if (!binding) {
    return '未连接子女'
  }
  return binding.status === 'bound' ? '已完成绑定' : '等待子女确认'
}

Page({
  data: {
    profile: DEFAULT_PROFILE,
    reportText: '还未测评',
    trainingText: '0/3',
    poseText: '还未检测',
    bindingText: '未连接子女',
    settings: defaultSettings,
    showQr: false,
    bindingLoading: false,
    bindingCode: '',
    bindingStatus: '点击生成绑定码',
    bindingQrUrl: '',
    showSettings: false,
    resettingDemo: false,
    frequencies: ['每天', '工作日', '周末'],
    sounds: ['默认铃声', '温和提醒', '欢快提醒']
  },

  onShow() {
    const report = getAssessment()
    const progress = getTrainingProgress()
    this.setData({
      profile: getElderProfile(DEFAULT_PROFILE),
      reportText: report ? `${report.levelText} · ${report.score}分` : '还未测评',
      trainingText: `${progress.completedIds.length}/3`,
      settings: getSettings(defaultSettings)
    })
    this.loadCloudProfile()
    this.loadCloudAssessment()
    this.loadLatestPose()
    this.loadBindingSummary()
  },

  async loadCloudProfile() {
    const cloudProfile = await getCloudElderProfile(DEFAULT_PROFILE)
    this.setData({ profile: cloudProfile })
  },

  async loadCloudAssessment() {
    const report = await getCloudAssessmentReport()
    this.setData({
      reportText: report ? `${report.levelText} · ${report.score}分` : '还未测评'
    })
  },

  async loadLatestPose() {
    const record = await getLatestPoseDetection()
    this.setData({
      poseText: buildPoseText(record)
    })
  },

  async loadBindingSummary() {
    const binding = await getOwnerBindingStatus()
    this.setData({
      bindingText: buildBindingText(binding)
    })
  },

  showQr() {
    this.setData({
      showQr: true,
      bindingCode: '',
      bindingQrUrl: '',
      bindingStatus: '正在准备绑定码…'
    })
    this.loadBindingInfo()
  },

  closeQr() {
    this.setData({ showQr: false })
  },

  async loadBindingInfo() {
    if (this.data.bindingLoading) {
      return
    }

    this.setData({ bindingLoading: true })

    try {
      const latest = await getLatestCaregiverBinding()
      if (latest) {
        this.setData({
          bindingCode: latest.bindingCode || '',
          bindingQrUrl: latest.qrImageUrl || '',
          bindingStatus: latest.status === 'pending' ? '请让子女扫码或输入绑定码' : '已完成子女绑定',
          bindingText: buildBindingText(latest)
        })
        return
      }

      const created = await createCaregiverBinding()
      this.setData({
        bindingCode: created.bindingCode || '',
        bindingQrUrl: created.qrImageUrl || '',
        bindingStatus: '请让子女扫码或输入绑定码',
        bindingText: '等待子女确认'
      })
    } catch (error) {
      this.setData({
        bindingCode: '',
        bindingQrUrl: '',
        bindingStatus: '暂时无法生成绑定码，请稍后重试'
      })
    } finally {
      this.setData({ bindingLoading: false })
    }
  },

  copyBindingCode() {
    if (!this.data.bindingCode) {
      wx.showToast({
        title: '还没有可复制的绑定码',
        icon: 'none'
      })
      return
    }

    wx.setClipboardData({
      data: this.data.bindingCode,
      success: () => {
        wx.showToast({
          title: '绑定码已复制',
          icon: 'success'
        })
      }
    })
  },

  openSettings() {
    this.setData({ showSettings: true })
  },

  closeSettings() {
    this.setData({ showSettings: false })
  },

  openTraining() {
    wx.navigateTo({ url: '/pages/records/index' })
  },

  openProfileEdit() {
    wx.navigateTo({ url: '/pages/profile/edit' })
  },

  openHealth() {
    wx.navigateTo({ url: '/pages/archive/index' })
  },

  openPoseHistory() {
    wx.navigateTo({ url: '/pages/pose/history' })
  },

  logout() {
    wx.showModal({
      title: '回到身份选择',
      content: '退出后会回到身份选择页，当前保存的资料和记录不会被清除。',
      confirmText: '返回',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) {
          return
        }
        clearCurrentRole()
        this.setData({ showSettings: false })
        wx.reLaunch({ url: '/pages/role/index' })
      }
    })
  },

  resetDemoData() {
    if (this.data.resettingDemo) {
      return
    }

    wx.showModal({
      title: '清空当前数据',
      content: '将清空当前账号的老人资料、训练进度、测评结果、姿势记录、绑定关系，以及本机缓存的数据。',
      confirmText: '确认清空',
      confirmColor: '#D95745',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) {
          return
        }

        this.setData({ resettingDemo: true })

        try {
          await Promise.all([
            deleteCloudElderProfile(),
            clearCloudAssessmentReport(),
            clearCaregiverBindings(),
            clearPoseDetectionHistory(),
            resetCloudTrainingProgress()
          ])
          clearDemoLocalData()

          wx.showToast({
            title: '当前数据已清空',
            icon: 'success'
          })

          setTimeout(() => {
            this.setData({
              showSettings: false,
              resettingDemo: false
            })
            wx.reLaunch({ url: '/pages/role/index' })
          }, 800)
        } catch (error) {
          this.setData({ resettingDemo: false })
          wx.showToast({
            title: '清空失败，请稍后重试',
            icon: 'none'
          })
        }
      }
    })
  },

  onReminderToggle(event) {
    this.updateSettings({ reminderEnabled: event.detail.value })
  },

  onTimeChange(event) {
    this.updateSettings({ reminderTime: event.detail.value })
  },

  onFrequencyChange(event) {
    this.updateSettings({ frequency: this.data.frequencies[event.detail.value] })
  },

  onSoundChange(event) {
    this.updateSettings({ sound: this.data.sounds[event.detail.value] })
  },

  onVoiceSpeedChange(event) {
    this.updateSettings({ voiceSpeed: Number(event.detail.value) / 100 })
  },

  updateSettings(partial) {
    const settings = {
      ...this.data.settings,
      ...partial
    }
    saveSettings(settings)
    this.setData({ settings })
  },

  noop() {}
})
