const {
  getCurrentRole,
  getCurrentOpenId,
  getElderProfile,
  saveCurrentOpenId,
  saveCurrentRole,
  clearDemoLocalData
} = require('../../utils/storage')
const { getSessionState } = require('../../services/authService')

const ROLE_ITEMS = [
  {
    role: 'elder',
    title: '老人端',
    desc: '完成建档、测评、每日练和小百科问答。',
    action: '进入老人端',
    image: '/assets/images/goose-main.png'
  },
  {
    role: 'caregiver',
    title: '子女端',
    desc: '确认绑定老人信息，查看家庭看护概览。',
    action: '进入子女端',
    image: '/assets/images/penguin/happy.jpg'
  }
]

const DEFAULT_LOCAL_PROFILE = {
  name: ''
}

Page({
  data: {
    roles: ROLE_ITEMS,
    mascot: '/assets/images/goose-main.png',
    checkingLogin: false,
    checkingText: ''
  },

  onShow() {
    this.tryAutoResume()
  },

  async tryAutoResume() {
    const role = getCurrentRole()
    if (!role || this.redirecting || this.autoChecking) {
      return
    }

    this.autoChecking = true
    this.setData({
      checkingLogin: true,
      checkingText: role === 'elder'
        ? '正在为您续上老人端资料…'
        : '正在为您打开子女端…'
    })

    try {
      await this.openRole(role, true)
    } finally {
      this.autoChecking = false
      if (!this.redirecting) {
        this.setData({
          checkingLogin: false,
          checkingText: ''
        })
      }
    }
  },

  async chooseRole(event) {
    const role = event.currentTarget.dataset.role
    if (!role || this.redirecting) {
      return
    }

    saveCurrentRole(role)
    this.setData({
      checkingLogin: true,
      checkingText: role === 'elder'
        ? '正在检查您的老人端资料…'
        : '正在进入子女端…'
    })

    await this.openRole(role, false)
  },

  async openRole(role, isResume) {
    this.redirecting = true

    try {
      const session = await getSessionState()
      const currentOpenId = String(session && session.openid || '')
      const savedOpenId = getCurrentOpenId()

      if (currentOpenId && savedOpenId && savedOpenId !== currentOpenId) {
        clearDemoLocalData()
        saveCurrentOpenId(currentOpenId)
        if (isResume) {
          return
        }
        saveCurrentRole(role)
      } else if (currentOpenId) {
        saveCurrentOpenId(currentOpenId)
      }

      if (role === 'elder') {
        const localProfile = getElderProfile(DEFAULT_LOCAL_PROFILE)
        const hasCloudProfile = Boolean(session && session.elder && session.elder.exists)
        const hasLocalProfile = Boolean(localProfile && localProfile.name)
        const canUseLocalResume = Boolean(!currentOpenId && isResume && hasLocalProfile)

        if (hasCloudProfile || canUseLocalResume) {
          wx.switchTab({ url: '/pages/home/index' })
          return
        }

        wx.navigateTo({ url: '/pages/login/elder' })
        return
      }

      wx.navigateTo({ url: '/pages/caregiver/index' })
    } finally {
      setTimeout(() => {
        this.redirecting = false
        this.setData({
          checkingLogin: false,
          checkingText: ''
        })
      }, 300)
    }
  }
})
