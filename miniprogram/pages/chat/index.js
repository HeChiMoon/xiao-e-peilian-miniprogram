const { knowledgeItems } = require('../../data/mock')
const { chatByText, chatByVoice } = require('../../services/voiceService')

const chatFaqItems = [
  { question: '膝关节疼痛怎么办？' },
  { question: '膝盖不好该怎么锻炼？' },
  { question: '日常怎么保护膝关节？' }
]

function findAnswer(input) {
  const text = String(input || '')
  const hit = knowledgeItems.find((item) => {
    const question = String(item.question || '').replace(/[？?]/g, '')
    return text.indexOf(question) >= 0 || question.indexOf(text) >= 0
  })
  if (hit) {
    return hit.answer
  }
  if (text.indexOf('膝') >= 0 || text.indexOf('关节') >= 0) {
    return '爷爷奶奶，膝关节不舒服时先别硬撑。可以休息一下，降低运动强度，慢慢观察。若疼痛持续、肿胀或无法行走，请及时就医。'
  }
  if (text.indexOf('运动') >= 0 || text.indexOf('锻炼') >= 0) {
    return '爷爷奶奶，适合中老年人的运动要慢、稳、低冲击。散步、太极、踝泵、直腿抬高都可以从短时间开始，别着急。'
  }
  return '爷爷奶奶，我是小鹅，可以像社区健康老师一样做膝关节科普。涉及诊断、用药和治疗方案，请咨询专业医生。'
}

function buildHistory(messages) {
  return messages.slice(-8).map((item) => ({
    role: item.role,
    text: item.text
  }))
}

function getFriendlyVoiceError(error) {
  const raw = String(error && (error.errMsg || error.message || error) || '')
  if (!raw) {
    return '语音识别失败，请再试一次。'
  }

  if (/auth|permission|permit|authorize|scope\.record/i.test(raw)) {
    return '麦克风权限还没打开，请在微信设置里允许麦克风后再试。'
  }

  if (/download|url|file_urls|access|403|404/i.test(raw)) {
    return '这次语音没有顺利传上去，请稍等一下再试。'
  }

  if (/timeout|超时/i.test(raw)) {
    return '语音识别有点慢，刚才超时了。请换一句短一点的话再试。'
  }

  if (/ASR|识别|transcription|task/i.test(raw)) {
    return '这次没有听清楚，您可以换个说法再试一次。'
  }

  return '语音没有成功，请再说一次。'
}

Page({
  data: {
    faq: chatFaqItems,
    inputValue: '',
    loading: false,
    recording: false,
    playingMessageIndex: -1,
    voiceStatus: '按住绿色按钮说话，松开后我来识别。',
    messages: [
      {
        role: 'ai',
        text: '爷爷奶奶好，我是小鹅。您可以按住说话，问我膝关节健康和训练注意事项。'
      }
    ]
  },

  onLoad() {
    this.recorderManager = wx.getRecorderManager()
    this.audioContext = wx.createInnerAudioContext()
    this.audioContext.obeyMuteSwitch = false
    this.autoPlayTimer = null
    this.recordingActive = false
    this.startingRecord = false
    this.stoppingRecord = false
    this.isPressingVoice = false
    this.stopWhenStarted = false
    this.recordStartTime = 0
    this.bindRecorderEvents()
    this.bindAudioEvents()
  },

  onUnload() {
    if (this._recordSafetyTimer) {
      clearTimeout(this._recordSafetyTimer)
    }
    if (this.autoPlayTimer) {
      clearTimeout(this.autoPlayTimer)
      this.autoPlayTimer = null
    }
    if (this.data.recording && this.recorderManager) {
      this.recorderManager.stop()
    }
    if (this.audioContext) {
      this.audioContext.stop()
      this.audioContext.destroy()
    }
  },

  bindAudioEvents() {
    if (!this.audioContext) {
      return
    }

    this.audioContext.onEnded(() => {
      this.setData({
        playingMessageIndex: -1,
        voiceStatus: '播放结束，可以继续提问。'
      })
    })

    this.audioContext.onError((error) => {
      console.warn('audio play failed', error)
      this.setData({
        playingMessageIndex: -1,
        voiceStatus: '语音播放失败，但文字回答已经显示。'
      })
    })
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
        recording: true,
        voiceStatus: '正在听您说话，松开按钮就发送。'
      })

      if (!this.isPressingVoice || this.stopWhenStarted) {
        this.stopRecord()
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
        recording: false,
        voiceStatus: '正在识别和回答，请稍等。'
      })

      if ((res.duration && res.duration < 700) || elapsed < 700) {
        this.setData({
          loading: false,
          voiceStatus: '说话时间太短了，请按住按钮说完整一点。'
        })
        return
      }

      this.handleVoiceFile(res.tempFilePath)
    })

    this.recorderManager.onError((error) => {
      console.warn('record failed', error)
      if (this._recordSafetyTimer) {
        clearTimeout(this._recordSafetyTimer)
        this._recordSafetyTimer = null
      }
      this.recordingActive = false
      this.startingRecord = false
      this.stoppingRecord = false
      this.stopWhenStarted = false
      this.setData({
        recording: false,
        loading: false,
        voiceStatus: getFriendlyVoiceError(error)
      })
    })
  },

  askQuestion(event) {
    const text = event.currentTarget.dataset.question
    this.addConversation(text)
  },

  onInput(event) {
    this.setData({ inputValue: event.detail.value })
  },

  sendMessage() {
    const text = this.data.inputValue.trim()
    if (!text || this.data.loading) {
      return
    }
    this.setData({ inputValue: '' })
    this.addConversation(text)
  },

  async addConversation(text) {
    const userMessage = { role: 'user', text }
    const nextMessages = this.data.messages.concat(userMessage)
    this.setData({
      messages: nextMessages,
      loading: true,
      voiceStatus: '小鹅正在想一想。'
    })

    try {
      const result = await chatByText(text, buildHistory(nextMessages))
      this.appendAIMessage(result.answerText, result.audioUrl, nextMessages, result)
    } catch (error) {
      console.warn('cloud text chat failed', error)
      this.appendAIMessage(findAnswer(text), '', nextMessages)
    }
  },

  appendAIMessage(text, audioUrl, baseMessages, result = {}) {
    const nextMessages = (baseMessages || this.data.messages).concat({
      role: 'ai',
      text: text || '爷爷奶奶，我刚才没想清楚，您可以换个说法再问我一次。',
      audioUrl: audioUrl || ''
    })
    const nextIndex = nextMessages.length - 1
    const ttsError = result && result.ttsError ? String(result.ttsError) : ''

    this.setData({
      messages: nextMessages,
      loading: false,
      voiceStatus: audioUrl
        ? '文字回答已显示，正在为您自动朗读。'
        : ttsError
          ? '文字回答已显示，这次语音没有准备好。'
          : '文字回答已显示，可以继续提问。'
    })

    if (audioUrl) {
      this.scheduleAutoPlay(nextIndex)
    }
  },

  startVoiceRecording() {
    if (this.data.loading) {
      return
    }

    if (this.data.recording || this.startingRecord) {
      return
    }

    this.isPressingVoice = true
    this.stopWhenStarted = false
    this.startRecord()
  },

  finishVoiceRecording() {
    this.isPressingVoice = false
    if (this.data.loading) {
      return
    }

    if (this.startingRecord) {
      this.stopWhenStarted = true
      return
    }

    this.stopRecord()
  },

  cancelVoiceRecording() {
    this.finishVoiceRecording()
  },

  startRecord() {
    if (!this.recorderManager) {
      this.setData({ voiceStatus: '当前基础库不支持录音。' })
      return
    }

    this.startingRecord = true
    this.recordStartTime = Date.now()
    this.setData({ voiceStatus: '准备录音，请继续按住。' })

    // 部分机型拒绝权限后既不 onStart 也不 onError，设个保险超时
    if (this._recordSafetyTimer) {
      clearTimeout(this._recordSafetyTimer)
    }
    this._recordSafetyTimer = setTimeout(() => {
      if (this.startingRecord && !this.recordingActive) {
        this.startingRecord = false
        this.isPressingVoice = false
        this.setData({
          recording: false,
          voiceStatus: '无法启动录音，请在微信设置中允许麦克风权限后重试。'
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

  stopRecord() {
    if (!this.recorderManager || this.stoppingRecord) {
      return
    }

    if (this.startingRecord && !this.recordingActive) {
      this.stopWhenStarted = true
      return
    }

    if (!this.recordingActive && !this.data.recording) {
      return
    }

    this.stoppingRecord = true
    this.recorderManager.stop()
  },

  async handleVoiceFile(tempFilePath) {
    if (!tempFilePath) {
      this.setData({
        loading: false,
        voiceStatus: '没有拿到录音文件，请再试一次。'
      })
      return
    }

    this.setData({ loading: true })
    try {
      const result = await chatByVoice(tempFilePath, buildHistory(this.data.messages))
      const transcript = result.transcript || '语音提问'
      const nextMessages = this.data.messages.concat({ role: 'user', text: transcript })
      this.setData({ messages: nextMessages })
      this.appendAIMessage(result.answerText, result.audioUrl, nextMessages, result)
    } catch (error) {
      console.warn('voice chat failed', error)
      this.setData({
        loading: false,
        voiceStatus: getFriendlyVoiceError(error)
      })
    }
  },

  playMessageAudio(event) {
    const index = Number(event.currentTarget.dataset.index)
    const message = this.data.messages[index]
    if (!message || !message.audioUrl) {
      return
    }

    if (this.data.playingMessageIndex === index) {
      this.audioContext.stop()
      this.setData({
        playingMessageIndex: -1,
        voiceStatus: '已停止播放，可以继续提问。'
      })
      return
    }

    this.playAudio(message.audioUrl, index)
  },

  scheduleAutoPlay(index) {
    if (this.autoPlayTimer) {
      clearTimeout(this.autoPlayTimer)
    }

    this.autoPlayTimer = setTimeout(() => {
      this.autoPlayTimer = null
      const message = this.data.messages[index]
      if (!message || !message.audioUrl) {
        return
      }
      this.playAudio(message.audioUrl, index, true)
    }, 300)
  },

  playAudio(audioUrl, index, isAuto = false) {
    if (!this.audioContext || !audioUrl) {
      return
    }

    this.audioContext.stop()
    this.audioContext.src = audioUrl
    this.setData({
      playingMessageIndex: index,
      voiceStatus: isAuto ? '正在自动朗读这条回答。' : '正在播放这条回答。'
    })
    this.audioContext.play()
  }
})
