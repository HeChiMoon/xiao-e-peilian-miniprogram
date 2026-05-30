const { getAssessment, saveAssessment } = require('../utils/storage')

const FUNCTION_NAME = 'assessmentService'

function canUseCloud() {
  return Boolean(wx.cloud && wx.cloud.callFunction)
}

function normalizeReport(report) {
  if (!report) {
    return null
  }

  return {
    ...report,
    score: Number(report.score) || 0,
    createdAt: report.createdAt || new Date().toLocaleDateString()
  }
}

function callAssessmentService(action, data = {}) {
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
      throw new Error(result.errMsg || '云端测评报告服务调用失败')
    }
    return normalizeReport(result.data)
  })
}

function saveCloudAssessmentReport(report) {
  const nextReport = normalizeReport(report)
  saveAssessment(nextReport)

  if (!canUseCloud()) {
    return Promise.resolve(nextReport)
  }

  return callAssessmentService('saveLatest', { report: nextReport }).then((cloudReport) => {
    saveAssessment(cloudReport)
    return cloudReport
  }).catch((error) => {
    console.warn('保存云端测评报告失败，已保留本地缓存', error)
    return nextReport
  })
}

function getCloudAssessmentReport() {
  if (!canUseCloud()) {
    return Promise.resolve(getAssessment())
  }

  return callAssessmentService('getLatest').then((cloudReport) => {
    if (!cloudReport) {
      return getAssessment()
    }
    saveAssessment(cloudReport)
    return cloudReport
  }).catch((error) => {
    console.warn('读取云端测评报告失败，使用本地缓存', error)
    return getAssessment()
  })
}

function clearCloudAssessmentReport() {
  saveAssessment(null)

  if (!canUseCloud()) {
    return Promise.resolve(true)
  }

  return callAssessmentService('clearLatest').catch((error) => {
    console.warn('清理云端测评报告失败', error)
    return true
  })
}

module.exports = {
  saveCloudAssessmentReport,
  getCloudAssessmentReport,
  clearCloudAssessmentReport
}
