const { adminDashboard } = require('../../data/mock')
const { clearCurrentRole } = require('../../utils/storage')

Page({
  data: {
    dashboard: adminDashboard
  },

  goRole() {
    clearCurrentRole()
    wx.reLaunch({ url: '/pages/role/index' })
  },

  manage() {
    wx.showToast({
      title: '管理员入口整理中',
      icon: 'none'
    })
  }
})
