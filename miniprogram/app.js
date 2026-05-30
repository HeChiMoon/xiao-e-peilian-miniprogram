const CLOUD_ENV_ID = 'cloud1-7gh2sy5r1102b28c'
const { initActionStandards } = require('./services/poseService')

App({
  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true
      })
      initActionStandards().catch(() => {})
    }

    this.globalData = {
      appName: '小鹅陪练',
      cloudEnvId: CLOUD_ENV_ID,
      cloudMode: Boolean(wx.cloud),
      mockMode: false
    }
  },
})
