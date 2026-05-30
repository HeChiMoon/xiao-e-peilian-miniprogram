const { getElderProfile, saveElderProfile } = require('../utils/storage')

const FUNCTION_NAME = 'elderService'

function canUseCloud() {
  return Boolean(wx.cloud && wx.cloud.callFunction)
}

function callElderService(action, data = {}) {
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
      throw new Error(result.errMsg || '云端老人资料服务调用失败')
    }
    return result.data
  })
}

function createOrUpdateElderProfile(profile) {
  return callElderService('createOrUpdate', { profile }).then((cloudProfile) => {
    saveElderProfile(cloudProfile)
    return cloudProfile
  })
}

function getCloudElderProfile(defaultProfile) {
  if (!canUseCloud()) {
    return Promise.resolve(getElderProfile(defaultProfile))
  }

  return callElderService('get').then((cloudProfile) => {
    if (!cloudProfile) {
      return getElderProfile(defaultProfile)
    }
    saveElderProfile(cloudProfile)
    return {
      ...defaultProfile,
      ...cloudProfile
    }
  }).catch((error) => {
    console.warn('读取云端老人资料失败，使用本地缓存', error)
    return getElderProfile(defaultProfile)
  })
}

function deleteCloudElderProfile() {
  if (!canUseCloud()) {
    return Promise.resolve(true)
  }

  return callElderService('deleteMine')
}

module.exports = {
  createOrUpdateElderProfile,
  getCloudElderProfile,
  deleteCloudElderProfile
}
