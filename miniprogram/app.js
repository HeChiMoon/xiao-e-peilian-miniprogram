const CLOUD_ENV_ID = 'cloud1-d5g3p79uad048cf6a'
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
