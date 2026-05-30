const { trainingLevels } = require('../../data/mock')
const { getTrainingProgress } = require('../../utils/storage')
const { getCloudTrainingProgress, getCloudTrainingPlan, resetCloudTrainingProgress } = require('../../services/trainingService')

function decorateLevels(progress, plan) {
  const recommendedIds = Array.isArray(plan && plan.recommendedIds) ? plan.recommendedIds : []
  const levelHints = plan && plan.levelHints ? plan.levelHints : {}
  return trainingLevels.map((level) => {
    const done = progress.completedIds.indexOf(level.id) >= 0
    const locked = level.id > progress.currentUnlocked
    const recommendedIndex = recommendedIds.indexOf(level.id)
    const focus = Number(plan && plan.focusLevelId) === level.id
    return {
      ...level,
      done,
      locked,
      recommended: recommendedIndex >= 0 && recommendedIndex < 3,
      focus,
      planHint: levelHints[level.id] || '',
      statusText: done ? '已完成' : locked ? '未解锁' : '可训练',
      badgeText: focus ? '今日先做' : recommendedIndex >= 0 && recommendedIndex < 3 ? '推荐' : ''
    }
  })
}

Page({
  data: {
    levels: [],
    progressText: '0/3',
    progressWidth: '0%',
    loadingProgress: false,
    resetting: false,
    plan: null,
    allCompleted: false
  },

  onShow() {
    const progress = getTrainingProgress()
    this.renderProgress(progress, this.data.plan)
    this.loadCloudProgress()
  },

  renderProgress(progress, plan) {
    this.currentProgress = progress
    const completedCount = progress.completedIds.length
    this.setData({
      levels: decorateLevels(progress, plan),
      progressText: `${completedCount}/${trainingLevels.length}`,
      progressWidth: `${Math.round((completedCount / trainingLevels.length) * 100)}%`,
      allCompleted: completedCount >= trainingLevels.length
    })
  },

  renderPlan(plan) {
    const progress = this.currentProgress || getTrainingProgress()
    this.setData({ plan })
    this.renderProgress(progress, plan)
  },

  async loadCloudProgress() {
    this.setData({ loadingProgress: true })
    try {
      const progress = await getCloudTrainingProgress()
      this.renderProgress(progress, this.data.plan)
      const plan = await getCloudTrainingPlan(progress)
      this.renderPlan(plan)
    } finally {
      this.setData({ loadingProgress: false })
    }
  },

  openLevel(event) {
    const { id, locked } = event.currentTarget.dataset
    if (Number(locked)) {
      wx.showToast({ title: '请先完成前面的动作', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/training/learn?id=${id}` })
  },

  async restartToday() {
    if (this.data.resetting) {
      return
    }

    this.setData({ resetting: true })
    try {
      const progress = await resetCloudTrainingProgress()
      this.renderProgress(progress, this.data.plan)
      const plan = await getCloudTrainingPlan(progress)
      this.renderPlan(plan)
      wx.showToast({ title: '已重新开始今日训练', icon: 'none' })
    } finally {
      this.setData({ resetting: false })
    }
  },

  quitTraining() {
    wx.switchTab({ url: '/pages/home/index' })
  }
})
