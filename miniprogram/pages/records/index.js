const { trainingLevels } = require('../../data/mock')
const { getTrainingProgress } = require('../../utils/storage')
const { getCloudTrainingProgress } = require('../../services/trainingService')

function buildSummary(progress) {
  const completedIds = Array.isArray(progress.completedIds) ? progress.completedIds : []
  const completedCount = completedIds.length
  const remainingCount = Math.max(trainingLevels.length - completedCount, 0)
  const nextLevel = trainingLevels.find((item) => completedIds.indexOf(item.id) < 0) || null

  return {
    progressText: `${completedCount}/${trainingLevels.length}`,
    completedCount,
    remainingCount,
    nextLevelText: nextLevel ? nextLevel.name : '今天已经全部完成',
    tipText: completedCount >= trainingLevels.length
      ? '今天的训练已经完成，可以休息一下，再看看健康知识。'
      : completedCount === 0
        ? '今天还没开始，先从第一个动作慢慢来就好。'
        : '继续完成剩下的动作，动作慢一点、稳一点就很好。'
  }
}

Page({
  data: {
    progressText: `0/${trainingLevels.length}`,
    completedLevels: [],
    todoLevels: [],
    completedCount: 0,
    remainingCount: trainingLevels.length,
    nextLevelText: '靠墙静蹲',
    tipText: '今天还没开始，先从第一个动作慢慢来就好。'
  },

  onShow() {
    const progress = getTrainingProgress()
    this.renderProgress(progress)
    this.loadCloudProgress()
  },

  renderProgress(progress) {
    const completedLevels = trainingLevels.filter((item) => progress.completedIds.indexOf(item.id) >= 0)
    const todoLevels = trainingLevels.filter((item) => progress.completedIds.indexOf(item.id) < 0)
    const summary = buildSummary(progress)

    this.setData({
      ...summary,
      completedLevels,
      todoLevels
    })
  },

  async loadCloudProgress() {
    const progress = await getCloudTrainingProgress()
    this.renderProgress(progress)
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/index' })
  },

  goTraining() {
    wx.navigateTo({ url: '/pages/training/index' })
  }
})
