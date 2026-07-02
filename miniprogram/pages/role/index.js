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
    desc: '测评、训练、小百科',
    action: '进入老人端',
    image: '/assets/images/xiao-e-icons/role-elder.png'
  },
  {
    role: 'caregiver',
    title: '子女端',
    desc: '绑定老人，看训练',
    action: '进入子女端',
    image: '/assets/images/xiao-e-icons/role-caregiver.png'
  }
]

const DEFAULT_LOCAL_PROFILE = {
  name: ''
}

Page({
  data: {
    roles: ROLE_ITEMS,
    mascot: '/assets/images/xiao-e-icons/voice-assistant.png',
    checkingLogin: false,
    checkingText: ''
  },

  onShow() {
    if (this._autoResumeTimer) {
      clearTimeout(this._autoResumeTimer)
    }
    this._autoResumeTimer = setTimeout(() => {
      this.tryAutoResume()
    }, 300)
  },

  onHide() {
    if (this._autoResumeTimer) {
      clearTimeout(this._autoResumeTimer)
      this._autoResumeTimer = null
    }
  },

  onUnload() {
    if (this._autoResumeTimer) {
      clearTimeout(this._autoResumeTimer)
      this._autoResumeTimer = null
    }
  },

  openPage(method, url) {
    return new Promise((resolve) => {
      setTimeout(() => {
        wx[method]({
          url,
          complete: resolve
        })
      }, 120)
    })
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
        ? '正在打开老人端'
        : '正在打开子女端'
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
        ? '正在进入老人端'
        : '正在进入子女端'
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
          return this.openPage('switchTab', '/pages/home/index')
        }

        return this.openPage('navigateTo', '/pages/login/elder')
      }

      return this.openPage('navigateTo', '/pages/caregiver/index')
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
