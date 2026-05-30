const FUNCTION_NAME = 'authService'

function canUseCloud() {
  return Boolean(wx.cloud && wx.cloud.callFunction)
}

function callAuthService(action, data = {}) {
  if (!canUseCloud()) {
    return Promise.reject(new Error('当前环境不支持微信云开发'))
  }

  return wx.cloud.callFunction({
    name: FUNCTION_NAME,
    data: {
      action,
      data
    }
  }).then((res) => {
    const result = res.result || {}
    if (!result.success) {
      throw new Error(result.errMsg || '微信登录状态读取失败')
    }
    return result.data || {}
  })
}

function getSessionState() {
  if (!canUseCloud()) {
    return Promise.resolve({
      openid: '',
      elder: { exists: false },
      caregiver: { exists: false },
      ownerBinding: { exists: false }
    })
  }

  return callAuthService('getSessionState').catch((error) => {
    console.warn('读取微信登录状态失败', error)
    return {
      openid: '',
      elder: { exists: false },
      caregiver: { exists: false },
      ownerBinding: { exists: false }
    }
  })
}

module.exports = {
  getSessionState
}
