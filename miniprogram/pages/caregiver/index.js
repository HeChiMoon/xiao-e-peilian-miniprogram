const { clearCurrentRole } = require('../../utils/storage')
const { confirmCaregiverBinding, getCaregiverBindingStatus } = require('../../services/bindingService')

function safeDecode(text) {
  try {
    return decodeURIComponent(text)
  } catch (error) {
    return text
  }
}

function extractBindingCode(raw) {
  const text = String(raw || '').trim()
  if (!text) {
    return ''
  }

  const decoded = safeDecode(text)

  const sceneMatch = decoded.match(/[?&]scene=([^&]+)/i)
  if (sceneMatch && sceneMatch[1]) {
    return safeDecode(sceneMatch[1]).trim()
  }

  const bindingMatch = decoded.match(/[?&]bindingCode=([^&]+)/i)
  if (bindingMatch && bindingMatch[1]) {
    return safeDecode(bindingMatch[1]).trim()
  }

  const codeMatch = decoded.match(/XE-[A-Z0-9-]+/i)
  if (codeMatch && codeMatch[0]) {
    return codeMatch[0].toUpperCase()
  }

  try {
    const parsed = JSON.parse(decoded)
    if (parsed && parsed.bindingCode) {
      return String(parsed.bindingCode).trim()
    }
  } catch (error) {
    // ignore invalid JSON payload
  }

  return decoded
}

function createEmptyDashboard() {
  return {
    elderCard: {
      name: '',
      age: '',
      healthLevel: '',
      painAreas: '',
      note: ''
    },
    assessmentCard: {
      title: '最近测评',
      primary: '暂未测评',
      secondary: '老人端完成一次测评后，这里会同步显示结果。'
    },
    poseCard: {
      title: '最近检测',
      primary: '暂未检测',
      secondary: '老人端完成一次相机检测后，这里会同步显示结果。'
    },
    trainingCard: {
      title: '今日训练',
      primary: '0/3 个动作',
      secondary: '老人端开始每日练后，这里会同步显示进度。'
    }
  }
}

Page({
  data: {
    bindingCode: '',
    bindingLoading: false,
    boundElder: null,
    statusText: '请扫描老人端二维码，或输入绑定码',
    statusTone: 'idle',
    detectedSource: '',
    successNote: '',
    dashboard: createEmptyDashboard()
  },

  onLoad(query) {
    const bindingCode = extractBindingCode(
      (query && (query.scene || query.bindingCode || query.q)) || ''
    )

    if (!bindingCode) {
      return
    }

    this.applyBindingCode(bindingCode, '已自动带入')
  },

  onShow() {
    this.loadBindingStatus()
  },

  applyBindingCode(bindingCode, sourceText) {
    this.setData({
      bindingCode,
      boundElder: null,
      statusText: '已识别绑定码，请确认绑定',
      statusTone: 'ready',
      detectedSource: sourceText,
      successNote: '',
      dashboard: createEmptyDashboard()
    })
  },

  applyBoundState(result) {
    const elder = result.elder || {
      name: result.elderName || '已绑定老人'
    }

    this.setData({
      boundElder: elder,
      bindingCode: '',
      statusText: '绑定成功，当前子女端已接通老人信息',
      statusTone: 'success',
      detectedSource: '已完成',
      successNote: `现在可以查看 ${elder.name} 的基础资料和最近训练概览。`,
      dashboard: result.dashboard || createEmptyDashboard()
    })
  },

  onBindingInput(event) {
    const bindingCode = extractBindingCode(event.detail.value)
    this.setData({
      bindingCode,
      statusText: bindingCode ? '已填写绑定码，请确认绑定' : '请扫描老人端二维码，或输入绑定码',
      statusTone: bindingCode ? 'ready' : 'idle',
      detectedSource: bindingCode ? '手动输入' : '',
      successNote: bindingCode ? '确认后将与对应老人建立绑定关系。' : '',
      boundElder: null,
      dashboard: createEmptyDashboard()
    })
  },

  async loadBindingStatus() {
    const binding = await getCaregiverBindingStatus()
    if (!binding) {
      return
    }

    this.applyBoundState(binding)
  },

  scanBindingCode() {
    if (this.data.bindingLoading) {
      return
    }

    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode'],
      success: (res) => {
        const bindingCode = extractBindingCode(
          res.path || res.result || res.rawData || ''
        )

        if (!bindingCode) {
          wx.showToast({
            title: '没有识别到绑定码',
            icon: 'none'
          })
          return
        }

        this.applyBindingCode(bindingCode, '扫码识别')
        wx.vibrateShort({
          type: 'light',
          fail: () => {}
        })
        wx.showToast({
          title: '已识别绑定码',
          icon: 'success'
        })
      },
      fail: () => {
        wx.showToast({
          title: '未完成扫码',
          icon: 'none'
        })
      }
    })
  },

  async confirmBinding() {
    const bindingCode = extractBindingCode(this.data.bindingCode)
    if (!bindingCode) {
      wx.showToast({
        title: '请输入绑定码',
        icon: 'none'
      })
      return
    }

    this.setData({
      bindingLoading: true,
      bindingCode
    })

    try {
      const result = await confirmCaregiverBinding(bindingCode)
      this.applyBoundState(result)

      wx.showToast({
        title: '绑定成功',
        icon: 'success'
      })
    } catch (error) {
      console.warn('子女端绑定失败', error)
      wx.showToast({
        title: '绑定失败，请检查绑定码',
        icon: 'none'
      })
    } finally {
      this.setData({ bindingLoading: false })
    }
  },

  goRole() {
    clearCurrentRole()
    wx.reLaunch({ url: '/pages/role/index' })
  }
})
