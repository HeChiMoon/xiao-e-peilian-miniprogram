const { saveCurrentRole, saveElderProfile } = require('../../utils/storage')
const { createOrUpdateElderProfile } = require('../../services/elderService')
const { chatByVoice } = require('../../services/voiceService')

const CURRENT_YEAR = new Date().getFullYear()
const DEFAULT_AGE = 65

const LOGIN_VOICE_TIPS = [
  {
    keyword: '怎么注册',
    answer: '先填姓名，再选择性别和出生年份，最后点完成注册就可以进入首页。'
  },
  {
    keyword: '年龄怎么选',
    answer: '拖动出生年份滑条，系统会自动帮您计算年龄。'
  },
  {
    keyword: '不会打字',
    answer: '可以请家人帮忙输入姓名，其他信息您自己点选也可以完成。'
  }
]

const DEFAULT_PROFILE = {
  name: '',
  gender: '男',
  birthYear: CURRENT_YEAR - DEFAULT_AGE,
  age: DEFAULT_AGE,
  healthLevel: '良好',
  avatar: '/assets/images/goose-main.png',
  phone: '',
  medicalHistory: '',
  painAreas: '',
  emergencyContact: '',
  height: '',
  weight: '',
  note: ''
}

function getVoiceAnswer(text) {
  const normalized = String(text || '').trim()
  const hit = LOGIN_VOICE_TIPS.find((item) => normalized.indexOf(item.keyword) >= 0)
  if (hit) {
    return hit.answer
  }

  if (normalized.indexOf('注册') >= 0) {
    return '先填写姓名，再选性别和出生年份，确认后就能先进入首页，后面还可以继续完善资料。'
  }
  if (normalized.indexOf('年龄') >= 0 || normalized.indexOf('出生') >= 0) {
    return '出生年份用滑条来选，系统会自动换算成年龄，您不用自己计算。'
  }
  if (normalized.indexOf('不会') >= 0 || normalized.indexOf('打字') >= 0) {
    return '不会打字也没关系，可以请家人帮忙输入姓名，其他信息点一下就能完成。'
  }

  return '我可以帮您回答注册、年龄选择和资料填写这些问题。您也可以按住说话再问我一次。'
}

function getFriendlyVoiceError(error) {
  const raw = String(error && (error.errMsg || error.message || error) || '')
  if (!raw) {
    return '语音识别失败，请再试一次。'
  }
  if (/auth|permission|scope\.record|authorize/i.test(raw)) {
    return '麦克风权限还没有打开，请在微信设置里允许麦克风后再试。'
  }
  if (/timeout|超时/i.test(raw)) {
    return '这次识别有点慢，刚才超时了，请换一句短一点的话再试。'
  }
  return '语音没有成功，请再说一次。'
}

Page({
  data: {
    mascot: '/assets/images/goose-main.png',
    name: '',
    gender: '男',
    birthYear: CURRENT_YEAR - DEFAULT_AGE,
    yearMin: CURRENT_YEAR - 90,
    yearMax: CURRENT_YEAR - 50,
    voiceOpen: false,
    voiceListening: false,
    voiceLoading: false,
    voiceQuery: '',
    voiceAnswer: '按住说话，小鹅会先把您的问题转成文字，再给您注册帮助。',
    voiceTips: LOGIN_VOICE_TIPS,
    saving: false
  },

  onLoad() {
    this.recorderManager = wx.getRecorderManager()
    this.recordingActive = false
    this.startingRecord = false
    this.stoppingRecord = false
    this.stopWhenStarted = false
    this.isPressingVoice = false
    this.recordStartTime = 0
    this.bindRecorderEvents()
  },

  onUnload() {
    if (this._recordSafetyTimer) {
      clearTimeout(this._recordSafetyTimer)
    }
    if (this.data.voiceListening && this.recorderManager) {
      this.recorderManager.stop()
    }
  },

  bindRecorderEvents() {
    if (!this.recorderManager) {
      return
    }

    this.recorderManager.onStart(() => {
      if (this._recordSafetyTimer) {
        clearTimeout(this._recordSafetyTimer)
        this._recordSafetyTimer = null
      }
      this.recordingActive = true
      this.startingRecord = false
      this.stoppingRecord = false
      this.setData({
        voiceListening: true,
        voiceLoading: false,
        voiceAnswer: '正在听您说话…'
      })

      if (!this.isPressingVoice || this.stopWhenStarted) {
        this.stopVoiceRecord()
      }
    })

    this.recorderManager.onStop((res) => {
      if (this._recordSafetyTimer) {
        clearTimeout(this._recordSafetyTimer)
        this._recordSafetyTimer = null
      }
      const elapsed = Date.now() - this.recordStartTime
      this.recordingActive = false
      this.startingRecord = false
      this.stoppingRecord = false
      this.stopWhenStarted = false

      this.setData({
        voiceListening: false,
        voiceLoading: true,
        voiceAnswer: '正在识别您的问题…'
      })

      if ((res.duration && res.duration < 700) || elapsed < 700) {
        this.setData({
          voiceLoading: false,
          voiceAnswer: '说话时间太短了，请按住按钮完整说一句。'
        })
        return
      }

      this.handleVoiceFile(res.tempFilePath)
    })

    this.recorderManager.onError((error) => {
      if (this._recordSafetyTimer) {
        clearTimeout(this._recordSafetyTimer)
        this._recordSafetyTimer = null
      }
      this.recordingActive = false
      this.startingRecord = false
      this.stoppingRecord = false
      this.stopWhenStarted = false
      this.setData({
        voiceListening: false,
        voiceLoading: false,
        voiceAnswer: getFriendlyVoiceError(error)
      })
    })
  },

  onNameInput(event) {
    this.setData({ name: event.detail.value })
  },

  chooseGender(event) {
    this.setData({ gender: event.currentTarget.dataset.gender })
  },

  onYearChange(event) {
    this.setData({ birthYear: Number(event.detail.value) })
  },

  async submit() {
    if (this.data.saving) {
      return
    }

    const name = this.data.name.trim()
    if (!name) {
      wx.showToast({
        title: '请先填写姓名',
        icon: 'none'
      })
      return
    }

    const elderProfile = {
      ...DEFAULT_PROFILE,
      name,
      gender: this.data.gender,
      birthYear: this.data.birthYear,
      age: CURRENT_YEAR - this.data.birthYear
    }

    this.setData({ saving: true })
    saveCurrentRole('elder')

    try {
      const savedProfile = await createOrUpdateElderProfile(elderProfile)
      saveElderProfile(savedProfile)

      wx.showToast({
        title: savedProfile.profileComplete ? '资料已保存' : '已保存，可继续完善',
        icon: 'none'
      })
      wx.switchTab({ url: '/pages/home/index' })
    } catch (error) {
      saveElderProfile(elderProfile)
      wx.showModal({
        title: '资料已先保存',
        content: '刚才没有同步成功，不过资料已经先保存在本机，稍后再试一次就可以。',
        showCancel: false,
        success: () => {
          wx.switchTab({ url: '/pages/home/index' })
        }
      })
    } finally {
      this.setData({ saving: false })
    }
  },

  openVoice() {
    this.setData({
      voiceOpen: true,
      voiceListening: false,
      voiceLoading: false,
      voiceQuery: '',
      voiceAnswer: '按住下方按钮说话，小鹅会先把您的问题转成文字。'
    })
  },

  closeVoice() {
    this.isPressingVoice = false
    this.stopWhenStarted = false
    this.setData({
      voiceOpen: false,
      voiceListening: false,
      voiceLoading: false
    })
  },

  askVoiceTip(event) {
    const text = event.currentTarget.dataset.keyword
    this.setData({
      voiceQuery: text,
      voiceAnswer: getVoiceAnswer(text)
    })
  },

  startVoiceRecording() {
    if (this.data.voiceLoading || this.data.voiceListening) {
      return
    }

    this.isPressingVoice = true
    this.stopWhenStarted = false
    this.startVoiceRecord()
  },

  finishVoiceRecording() {
    this.isPressingVoice = false
    if (this.startingRecord) {
      this.stopWhenStarted = true
      return
    }
    this.stopVoiceRecord()
  },

  cancelVoiceRecording() {
    this.finishVoiceRecording()
  },

  startVoiceRecord() {
    if (!this.recorderManager) {
      this.setData({ voiceAnswer: '当前基础库不支持录音。' })
      return
    }

    this.startingRecord = true
    this.recordStartTime = Date.now()
    this.setData({
      voiceListening: false,
      voiceLoading: false,
      voiceAnswer: '准备录音，请继续按住。'
    })

    if (this._recordSafetyTimer) {
      clearTimeout(this._recordSafetyTimer)
    }
    this._recordSafetyTimer = setTimeout(() => {
      if (this.startingRecord && !this.recordingActive) {
        this.startingRecord = false
        this.isPressingVoice = false
        this.setData({
          voiceListening: false,
          voiceLoading: false,
          voiceAnswer: '无法启动录音，请检查麦克风权限后再试。'
        })
      }
    }, 1200)

    this.recorderManager.start({
      duration: 10000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 64000,
      format: 'mp3'
    })
  },

  stopVoiceRecord() {
    if (!this.recorderManager || this.stoppingRecord) {
      return
    }

    if (this.startingRecord && !this.recordingActive) {
      this.stopWhenStarted = true
      return
    }

    if (!this.recordingActive && !this.data.voiceListening) {
      return
    }

    this.stoppingRecord = true
    this.recorderManager.stop()
  },

  async handleVoiceFile(tempFilePath) {
    if (!tempFilePath) {
      this.setData({
        voiceLoading: false,
        voiceAnswer: '没有拿到录音文件，请再试一次。'
      })
      return
    }

    try {
      const result = await chatByVoice(tempFilePath, [])
      const transcript = String(result.transcript || '').trim()
      this.setData({
        voiceLoading: false,
        voiceQuery: transcript || '未识别清楚',
        voiceAnswer: transcript ? getVoiceAnswer(transcript) : '这次没有听清楚，您可以再说一次。'
      })
    } catch (error) {
      this.setData({
        voiceLoading: false,
        voiceAnswer: getFriendlyVoiceError(error)
      })
    }
  },

  noop() {}
})
