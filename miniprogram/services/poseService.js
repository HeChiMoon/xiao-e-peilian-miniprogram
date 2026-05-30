const FUNCTION_NAME = 'poseService'
const CLOUD_SOURCE_LIMIT = 2 * 1024 * 1024
const TARGET_UPLOAD_SIZE = 1800 * 1024
const COMPRESS_QUALITIES = [80, 65, 50, 35]

function canUseCloud() {
  return Boolean(wx.cloud && wx.cloud.callFunction && wx.cloud.uploadFile)
}

function isAliyunSuccess(record) {
  return record && record.engine === 'aliyun-body-posture-v1'
}

function buildCloudPath(actionKey, tempFilePath, fallbackSuffix = 'jpg') {
  const suffix = String(tempFilePath || '').split('.').pop() || fallbackSuffix
  const safeAction = actionKey || 'knee'
  return `pose-detections/${safeAction}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${suffix}`
}

function getLocalFileInfo(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileInfo({
      filePath,
      success: resolve,
      fail: reject
    })
  })
}

function compressLocalImage(src, quality) {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src,
      quality,
      success: (res) => resolve(res.tempFilePath || src),
      fail: reject
    })
  })
}

async function preparePoseImageForUpload(tempFilePath) {
  let currentPath = tempFilePath
  let info = await getLocalFileInfo(currentPath).catch(() => null)

  if (info && info.size <= TARGET_UPLOAD_SIZE) {
    return currentPath
  }

  for (const quality of COMPRESS_QUALITIES) {
    currentPath = await compressLocalImage(currentPath, quality).catch(() => currentPath)
    info = await getLocalFileInfo(currentPath).catch(() => null)
    if (info && info.size <= TARGET_UPLOAD_SIZE) {
      return currentPath
    }
  }

  if (info && info.size > CLOUD_SOURCE_LIMIT) {
    throw new Error('图片过大，请靠近一点重新拍，或稍后再试。')
  }

  return currentPath
}

function buildActionFailureSuggestion(actionKey) {
  if (actionKey === 'legRaise') {
    return '本次没有识别到有效骨架点。直腿抬高现在只支持坐姿做法，请从身体侧面拍，把腰胯、抬起腿和自然下垂那条腿一起拍完整。'
  }
  if (actionKey === 'wallSquat') {
    return '本次没有识别到有效骨架点。请从身体侧前方拍，把髋、膝、踝都放进画面，再重新检测。'
  }
  if (actionKey === 'singleLegStand') {
    return '本次没有识别到有效骨架点。请把支撑腿、抬起腿和双脚都拍完整，再重新检测。'
  }
  return '本次没有识别到有效骨架点，请调整拍摄角度后重新检测。'
}

function buildLegRaiseSuggestion(riskLevel, angles = {}) {
  const activeKnee = Number(angles.activeKnee) || 0
  const lineAngle = Number(angles.activeLegLineAngle) || 0

  if (riskLevel === 'high') {
    if (activeKnee < 150) {
      return '按坐姿抬腿看，这次主要问题是抬起腿还没伸直。先坐稳，再把膝盖伸直后慢慢往前送。'
    }
    if (lineAngle > 32) {
      return '按坐姿抬腿看，这次主要问题是腿还不够平。把抬起那条腿再往前送一点，尽量接近平着。'
    }
    return '按坐姿抬腿看，这次动作还不稳定。保持上身坐稳，另一条腿自然下垂，抬腿时慢一点。'
  }

  if (riskLevel === 'middle') {
    return lineAngle > 26
      ? '按坐姿抬腿看，动作基本到了，再把抬起那条腿送平一点会更标准。'
      : '按坐姿抬腿看，动作基本完成，继续保持坐稳、抬腿慢、落腿慢。'
  }

  return '按坐姿抬腿看，动作完成得比较稳，继续保持膝盖伸直、腿向前平稳抬起。'
}

function buildActionSuggestion(record, detected) {
  const actionKey = record && record.actionKey
  const riskLevel = record && record.riskLevel
  const angles = record && record.angles ? record.angles : {}

  if (!detected) {
    return buildActionFailureSuggestion(actionKey)
  }

  if (actionKey === 'legRaise') {
    return buildLegRaiseSuggestion(riskLevel, angles)
  }
  if (actionKey === 'wallSquat') {
    if (riskLevel === 'high') {
      return '这次靠墙静蹲幅度或稳定性还不够。请从侧前方拍，让髋、膝、踝都入镜，再慢慢下蹲。'
    }
    if (riskLevel === 'middle') {
      return '这次靠墙静蹲基本完成，继续保持背部贴墙，手机尽量放在身体侧前方。'
    }
    return '这次靠墙静蹲完成得比较稳，继续保持背部贴墙和慢慢下蹲。'
  }
  if (actionKey === 'singleLegStand') {
    if (riskLevel === 'high') {
      return '这次单腿站立还不够稳。先扶稳椅背，支撑腿站稳后，再轻轻抬起另一只脚。'
    }
    if (riskLevel === 'middle') {
      return '这次单腿站立基本完成，继续扶稳椅背，支撑腿保持稳定。'
    }
    return '这次单腿站立完成得比较稳，继续保持支撑腿稳定和身体放松。'
  }

  return detected
    ? '本次检测已完成，请继续保持低强度、慢节奏训练。'
    : '本次没有识别到有效骨架点，请调整拍摄角度后重新检测。'
}

function buildRiskText(record, detected) {
  if (!detected) {
    return '识别失败'
  }
  if (record.riskLevel === 'high') {
    return '需要关注'
  }
  if (record.riskLevel === 'middle') {
    return '可以改进'
  }
  return '动作稳定'
}

function normalizeRecord(record) {
  if (!record) {
    return null
  }

  const detected = isAliyunSuccess(record)
  const angles = detected && record.angles ? record.angles : {}
  const keypoints = detected && Array.isArray(record.keypoints) ? record.keypoints : []
  const standard = record.standard || {}
  const score = detected ? Number(record.score) || 0 : 0

  return {
    ...record,
    detected,
    score,
    angles,
    standard,
    keypoints,
    riskText: buildRiskText(record, detected),
    suggestion: buildActionSuggestion({ ...record, angles }, detected)
  }
}

function callPoseService(action, data = {}) {
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
      throw new Error(result.errMsg || '姿态检测服务调用失败')
    }
    return result.data
  })
}

function uploadPoseImage(tempFilePath, actionKey) {
  if (!tempFilePath) {
    return Promise.reject(new Error('缺少本地检测图片'))
  }

  if (!canUseCloud()) {
    return Promise.reject(new Error('当前基础库不支持云存储上传'))
  }

  return preparePoseImageForUpload(tempFilePath).then((preparedPath) => {
    const cloudPath = buildCloudPath(actionKey, preparedPath, 'jpg')
    return wx.cloud.uploadFile({
      cloudPath,
      filePath: preparedPath
    }).then((res) => ({
      fileID: res.fileID,
      cloudPath,
      mediaType: 'image'
    }))
  })
}

function analyzePoseImage(payload) {
  return callPoseService('analyzeImage', {
    ...payload,
    mediaType: payload.mediaType || 'image'
  }).then(normalizeRecord)
}

function uploadAndAnalyzePoseImage(tempFilePath, actionKey) {
  return uploadPoseImage(tempFilePath, actionKey).then((uploadResult) => {
    return analyzePoseImage({
      ...uploadResult,
      actionKey
    })
  })
}

function getLatestPoseDetection() {
  if (!canUseCloud()) {
    return Promise.resolve(null)
  }

  return callPoseService('getLatest').then(normalizeRecord).catch((error) => {
    console.warn('读取最近一次姿态检测失败', error)
    return null
  })
}

function listPoseDetectionHistory(limit = 20) {
  if (!canUseCloud()) {
    return Promise.resolve([])
  }

  return callPoseService('listHistory', { limit }).then((records) => {
    return Array.isArray(records) ? records.map(normalizeRecord) : []
  }).catch((error) => {
    console.warn('读取姿态检测历史失败', error)
    return []
  })
}

function getPoseDetectionDetail(id) {
  if (!canUseCloud()) {
    return Promise.resolve({
      record: null,
      previous: null
    })
  }

  return callPoseService('getDetail', { id }).then((data) => ({
    record: normalizeRecord(data && data.record),
    previous: normalizeRecord(data && data.previous)
  })).catch((error) => {
    console.warn('读取姿态检测详情失败', error)
    return {
      record: null,
      previous: null
    }
  })
}

function clearPoseDetectionHistory() {
  if (!canUseCloud()) {
    return Promise.resolve(true)
  }

  return callPoseService('clearMine').catch((error) => {
    console.warn('清理姿态检测记录失败', error)
    return true
  })
}

function initActionStandards() {
  if (!canUseCloud()) {
    return Promise.reject(new Error('当前基础库不支持微信云开发'))
  }

  return callPoseService('initStandards').then((results) => {
    return Array.isArray(results) ? results : []
  }).catch((error) => {
    console.warn('初始化动作标准库失败', error)
    return []
  })
}

const uploadPoseVideo = uploadPoseImage
const analyzePoseVideo = analyzePoseImage
const uploadAndAnalyzePoseVideo = uploadAndAnalyzePoseImage

module.exports = {
  uploadPoseImage,
  analyzePoseImage,
  uploadAndAnalyzePoseImage,
  uploadPoseVideo,
  analyzePoseVideo,
  uploadAndAnalyzePoseVideo,
  getLatestPoseDetection,
  listPoseDetectionHistory,
  getPoseDetectionDetail,
  initActionStandards,
  clearPoseDetectionHistory
}
