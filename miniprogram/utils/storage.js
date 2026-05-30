const TRAINING_KEY = 'xiao-e-training-progress'
const ASSESSMENT_KEY = 'xiao-e-assessment-report'
const VIDEO_KEY = 'xiao-e-video-state'
const SETTINGS_KEY = 'xiao-e-settings'
const ROLE_KEY = 'xiao-e-current-role'
const ELDER_PROFILE_KEY = 'xiao-e-elder-profile'
const OPENID_KEY = 'xiao-e-current-openid'

function pad(value) {
  return String(value).padStart(2, '0')
}

function getTodayKey() {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function normalizeTrainingProgress(progress) {
  const todayKey = getTodayKey()
  const progressDate = progress && progress.progressDate ? String(progress.progressDate) : ''

  if (progressDate !== todayKey) {
    return {
      completedIds: [],
      currentUnlocked: 1,
      progressDate: todayKey
    }
  }

  return {
    completedIds: Array.isArray(progress && progress.completedIds)
      ? Array.from(new Set(progress.completedIds.map(Number).filter(Boolean)))
      : [],
    currentUnlocked: Number(progress && progress.currentUnlocked) || 1,
    progressDate: todayKey
  }
}

function getTrainingProgress() {
  const saved = wx.getStorageSync(TRAINING_KEY) || null
  const normalized = normalizeTrainingProgress(saved)

  if (
    !saved ||
    saved.progressDate !== normalized.progressDate ||
    JSON.stringify(saved.completedIds || []) !== JSON.stringify(normalized.completedIds) ||
    Number(saved.currentUnlocked || 1) !== normalized.currentUnlocked
  ) {
    wx.setStorageSync(TRAINING_KEY, normalized)
  }

  return normalized
}

function completeLevel(id, total) {
  const progress = getTrainingProgress()
  const completedIds = Array.from(new Set(progress.completedIds.concat(Number(id)))).filter(Boolean)
  const currentUnlocked = Math.min(Math.max(progress.currentUnlocked, Number(id) + 1), Number(total) || 1)
  const next = {
    completedIds,
    currentUnlocked,
    progressDate: getTodayKey()
  }
  wx.setStorageSync(TRAINING_KEY, next)
  return next
}

function saveTrainingProgress(progress) {
  const normalized = normalizeTrainingProgress(progress)
  wx.setStorageSync(TRAINING_KEY, normalized)
  return normalized
}

function resetTrainingProgress() {
  const reset = {
    completedIds: [],
    currentUnlocked: 1,
    progressDate: getTodayKey()
  }
  wx.setStorageSync(TRAINING_KEY, reset)
  return reset
}

function saveAssessment(report) {
  wx.setStorageSync(ASSESSMENT_KEY, report)
}

function getAssessment() {
  return wx.getStorageSync(ASSESSMENT_KEY) || null
}

function getVideoState() {
  return wx.getStorageSync(VIDEO_KEY) || {}
}

function saveVideoState(state) {
  wx.setStorageSync(VIDEO_KEY, state)
}

function getSettings(defaults) {
  return wx.getStorageSync(SETTINGS_KEY) || defaults
}

function saveSettings(value) {
  wx.setStorageSync(SETTINGS_KEY, value)
}

function getCurrentRole() {
  return wx.getStorageSync(ROLE_KEY) || ''
}

function saveCurrentRole(role) {
  wx.setStorageSync(ROLE_KEY, role)
}

function clearCurrentRole() {
  wx.removeStorageSync(ROLE_KEY)
}

function getCurrentOpenId() {
  return wx.getStorageSync(OPENID_KEY) || ''
}

function saveCurrentOpenId(openid) {
  wx.setStorageSync(OPENID_KEY, String(openid || ''))
}

function getElderProfile(defaultProfile) {
  const saved = wx.getStorageSync(ELDER_PROFILE_KEY) || {}
  return {
    ...defaultProfile,
    ...saved
  }
}

function saveElderProfile(profile) {
  wx.setStorageSync(ELDER_PROFILE_KEY, profile)
}

function clearDemoLocalData() {
  resetTrainingProgress()
  wx.removeStorageSync(ASSESSMENT_KEY)
  wx.removeStorageSync(VIDEO_KEY)
  wx.removeStorageSync(SETTINGS_KEY)
  wx.removeStorageSync(ROLE_KEY)
  wx.removeStorageSync(ELDER_PROFILE_KEY)
  wx.removeStorageSync(OPENID_KEY)
}

module.exports = {
  getTodayKey,
  getTrainingProgress,
  completeLevel,
  saveTrainingProgress,
  resetTrainingProgress,
  saveAssessment,
  getAssessment,
  getVideoState,
  saveVideoState,
  getSettings,
  saveSettings,
  getCurrentRole,
  saveCurrentRole,
  clearCurrentRole,
  getCurrentOpenId,
  saveCurrentOpenId,
  getElderProfile,
  saveElderProfile,
  clearDemoLocalData
}
