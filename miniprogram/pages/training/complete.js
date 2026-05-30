const { trainingLevels } = require('../../data/mock')

Page({
  data: {
    level: null,
    all: false,
    nextId: 0,
    title: '',
    copy: '',
    primaryText: ''
  },

  onLoad(query) {
    const id = Number(query.id || 1)
    const level = trainingLevels.find((item) => item.id === id) || trainingLevels[0]
    const all = query.all === '1'
    this.setData({
      level,
      all,
      nextId: id + 1,
      title: all ? '今天的训练完成了' : '这一关通过了',
      copy: all ? `今天 ${trainingLevels.length} 个关卡已经全部完成，记得训练后放松腿部。` : `${level.name} 已完成，休息一下再进入下一关。`,
      primaryText: all ? '查看训练地图' : '进入下一关'
    })
  },

  nextLevel() {
    if (this.data.all) {
      wx.navigateTo({ url: '/pages/training/index' })
      return
    }
    wx.redirectTo({ url: `/pages/training/learn?id=${this.data.nextId}` })
  },

  backMap() {
    wx.navigateTo({ url: '/pages/training/index' })
  }
})
