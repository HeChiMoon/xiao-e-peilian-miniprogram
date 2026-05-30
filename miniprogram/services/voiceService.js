const FUNCTION_NAME = 'voiceService'

function canUseCloud() {
  return Boolean(wx.cloud && wx.cloud.callFunction && wx.cloud.uploadFile)
}

function callVoiceService(action, data = {}) {
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
      throw new Error(result.errMsg || '语音服务调用失败')
    }
    return result.data
  })
}

function buildVoiceCloudPath(tempFilePath) {
  const matched = String(tempFilePath || '').toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/)
  const suffix = matched && ['aac', 'mp3', 'wav', 'pcm', 'm4a'].includes(matched[1])
    ? matched[1]
    : 'mp3'
  return `voice-recordings/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${suffix}`
}

function uploadVoiceAudio(tempFilePath) {
  if (!tempFilePath) {
    return Promise.reject(new Error('缺少录音文件'))
  }

  if (!canUseCloud()) {
    return Promise.reject(new Error('当前基础库不支持云存储上传'))
  }

  const cloudPath = buildVoiceCloudPath(tempFilePath)
  return wx.cloud.uploadFile({
    cloudPath,
    filePath: tempFilePath
  }).then((res) => ({
    fileID: res.fileID,
    cloudPath
  }))
}

function chatByText(text, history = []) {
  return callVoiceService('chat', {
    text,
    history
  })
}

function chatByVoice(tempFilePath, history = []) {
  return uploadVoiceAudio(tempFilePath).then((uploadResult) => {
    return callVoiceService('chat', {
      ...uploadResult,
      history
    })
  })
}

module.exports = {
  chatByText,
  chatByVoice,
  uploadVoiceAudio
}
