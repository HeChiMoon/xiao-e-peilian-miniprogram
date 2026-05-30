const FUNCTION_NAME = 'bindingService'

function canUseCloud() {
  return Boolean(wx.cloud && wx.cloud.callFunction)
}

function callBindingService(action, data = {}) {
  if (!canUseCloud()) {
    return Promise.reject(new Error('当前基础库不支持微信云开发'))
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
      throw new Error(result.errMsg || '云端绑定服务调用失败')
    }
    return result.data
  })
}

function createCaregiverBinding() {
  if (!canUseCloud()) {
    return Promise.reject(new Error('当前环境暂不支持生成绑定码'))
  }

  return callBindingService('createBindingCode')
}

function getLatestCaregiverBinding() {
  if (!canUseCloud()) {
    return Promise.resolve(null)
  }

  return callBindingService('getLatest').catch((error) => {
    console.warn('读取云端绑定信息失败', error)
    return null
  })
}

function getOwnerBindingStatus() {
  if (!canUseCloud()) {
    return Promise.resolve(null)
  }

  return callBindingService('getOwnerBindingStatus').catch((error) => {
    console.warn('读取老人端绑定状态失败', error)
    return null
  })
}

function confirmCaregiverBinding(bindingCode) {
  if (!canUseCloud()) {
    return Promise.reject(new Error('当前基础库不支持微信云开发'))
  }

  return callBindingService('confirmBinding', { bindingCode })
}

function getCaregiverBindingStatus() {
  if (!canUseCloud()) {
    return Promise.resolve(null)
  }

  return callBindingService('getCaregiverBinding').catch((error) => {
    console.warn('读取子女端绑定状态失败', error)
    return null
  })
}

function clearCaregiverBindings() {
  if (!canUseCloud()) {
    return Promise.resolve(true)
  }

  return callBindingService('clearMine').catch((error) => {
    console.warn('清理绑定关系失败', error)
    return true
  })
}

module.exports = {
  createCaregiverBinding,
  getLatestCaregiverBinding,
  getOwnerBindingStatus,
  confirmCaregiverBinding,
  getCaregiverBindingStatus,
  clearCaregiverBindings
}
