const { trainingLevels } = require('../../data/mock')

function normalizeLevel(level) {
  if (!level) {
    return null
  }

  return {
    ...level,
    image: level.image || '/assets/images/xiao-e-icons/voice-assistant.png'
  }
}

Page({
  data: {
    level: null,
    showDialog: false
  },

  onLoad(query) {
    const id = Number(query.id || 1)
    const level = normalizeLevel(trainingLevels.find((item) => item.id === id) || trainingLevels[0])

    this.setData({ level })
  },

  notYet() {
    wx.showToast({
      title: '再看一遍，别着急',
      icon: 'none'
    })
  },

  understood() {
    this.setData({ showDialog: true })
  },

  closeDialog() {
    this.setData({ showDialog: false })
  },

  noop() {},

  startPractice() {
    wx.navigateTo({ url: `/pages/training/practice?id=${this.data.level.id}` })
  }
})
