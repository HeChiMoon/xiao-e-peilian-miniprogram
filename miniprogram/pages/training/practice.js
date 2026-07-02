const { trainingLevels } = require('../../data/mock')
const { completeLevel } = require('../../utils/storage')
const { completeCloudLevel } = require('../../services/trainingService')
const { createVisionSession } = require('./services/visionService')
const { getVisionRule } = require('./services/trainingVisionRules')
const { uploadPoseImage, analyzePoseImage } = require('../../services/poseService')

const FRAME_INTERVAL = 360
const CLOUD_POSE_INTERVAL = 1200
const CLOUD_COUNT_COOLDOWN = 2000
const CLOUD_MAX_ATTEMPTS = 10
const COMPLETE_DELAY = 5500

function getCloudActionKey(levelId) {
  const map = {
    1: 'wallSquat',
    2: 'legRaise',
    3: 'singleLegStand'
  }
  return map[Number(levelId)] || 'legRaise'
}

function getPassScore(actionKey) {
  const map = {
    wallSquat: 74,
    legRaise: 70,
    singleLegStand: 72
  }
  return map[actionKey] || 76
}

function isFinalLevel(levelId) {
  return Number(levelId) >= trainingLevels.length
}

function formatCloudPoseFeedback(record, actionKey) {
  if (!record) {
    return {
      status: 'waiting',
      label: '等待检测',
      message: '系统会定时看一看动作情况，给您简单提醒。',
      angleText: '--',
      scoreText: '--'
    }
  }

  const angles = record.angles || {}
  const angle = Number(angles.activeKnee || angles.supportKnee || angles.averageKnee) || 0
  const legLineAngle = Number(angles.activeLegLineAngle) || 0
  const activeSide = angles.activeSide === 'left' ? '左腿' : angles.activeSide === 'right' ? '右腿' : '主动腿'
  const supportSide = angles.supportSide === 'left' ? '左腿' : angles.supportSide === 'right' ? '右腿' : '支撑腿'
  const score = Number(record.score) || 0
  const standard = record.standard || {}
  const min = Number(standard.minAngle) || 0
  const max = Number(standard.maxAngle) || 180
  const passScore = getPassScore(actionKey)
  const engineOk = record.engine === 'aliyun-body-posture-v1'
  let message = record.suggestion || '已经看清动作，请继续保持安全节奏。'
  let label = engineOk ? '已看清动作' : '这次未看清'
  let status = score >= passScore ? 'qualified' : score >= 55 ? 'ready' : 'unstable'

  if (!engineOk) {
    status = 'unsupported'
    message = '这次检测没有成功，请调整姿势后再试。'
  } else if (actionKey === 'wallSquat' && angle > max) {
    message = `当前主要侧膝关节约 ${angle} 度，下蹲还不够明显。请背部贴墙，双脚向前一点，慢慢下蹲。`
    label = '下蹲幅度偏小'
  } else if (actionKey === 'wallSquat' && angle < min) {
    message = `当前主要侧膝关节约 ${angle} 度，下蹲幅度偏大，请稍微站高一点。`
    label = '下蹲幅度偏大'
  } else if (actionKey !== 'wallSquat' && angle < min) {
    message = `当前膝关节约 ${angle} 度，膝盖可以再伸直一点，动作慢慢来。`
    label = '膝盖需要更伸直'
  } else if (actionKey === 'legRaise' && legLineAngle < 8) {
    message = `当前${activeSide}抬起高度还不够，请坐稳或扶稳后，慢慢把腿抬高一点。`
    label = '抬腿高度不够'
  } else if (actionKey === 'singleLegStand' && Number(angles.liftAnkleRaise || 0) < 0.035 && Number(angles.liftKnee || 180) > 155) {
    message = '还没有形成明显的单腿站立，请扶稳后再慢慢抬起一只脚。'
    label = '请抬起一只脚'
  } else if (score >= passScore) {
    if (actionKey === 'legRaise') {
      message = `当前${activeSide}膝关节约 ${angle} 度，抬腿高度合适，继续慢起慢落。`
    } else if (actionKey === 'singleLegStand') {
      message = `当前${supportSide}膝关节约 ${angle} 度，支撑腿稳定，动作达标。`
    } else if (actionKey === 'wallSquat') {
      message = `当前主要侧膝关节约 ${angle} 度，靠墙静蹲达标，继续保持背部贴墙。`
    }
  }

  return {
    status,
    label,
    message,
    angleText: `${angle}度`,
    scoreText: `${score}分`,
    shouldCount: engineOk && score >= passScore
  }
}

Page({
  data: {
    devMode: false,
    level: null,
    isFinalLevel: false,
    count: 0,
    total: 1,
    progressWidth: '0%',
    message: '请站在镜头前，我们要开始啦',
    cameraReady: false,
    recognitionActive: false,
    visionLabel: '等待相机',
    visionStatus: 'waiting',
    visionScore: 0,
    qualityItems: [],
    visionRuleName: '',
    visionHint: '',
    cloudPoseActive: false,
    cloudPoseChecking: false,
    cloudPoseStatus: 'waiting',
    cloudPoseLabel: '等待检测',
    cloudPoseMessage: '系统会定时看一看动作情况，给您简单提醒。',
    cloudPoseAngle: '--',
    cloudPoseScore: '--',
    cloudPoseAttempts: 0,
    completing: false,
    completeMessage: ''
  },

  onLoad(query) {
    const id = Number(query.id || 1)
    const level = trainingLevels.find((item) => item.id === id) || trainingLevels[0]
    const visionRule = getVisionRule(level.id)
    this.visionRule = visionRule
    this.cloudActionKey = getCloudActionKey(level.id)
    this.lastCloudCountAt = 0
    this.cloudPoseAttempts = 0
    this.setData({
      level,
      isFinalLevel: isFinalLevel(level.id),
      visionRuleName: visionRule.name,
      visionHint: visionRule.hint
    })
    this.visionSession = createVisionSession(visionRule)
  },

  onReady() {
    this.cameraContext = wx.createCameraContext()
  },

  onShow() {
    if (this.data.cameraReady && !this.data.recognitionActive) {
      this.startVision()
    }
    if (this.data.cameraReady && !this.data.cloudPoseActive) {
      this.startCloudPoseCoach()
    }
  },

  onHide() {
    this.stopVision()
    this.stopCloudPoseCoach()
    if (this.completeTimer) {
      clearTimeout(this.completeTimer)
      this.completeTimer = null
    }
  },

  onUnload() {
    this.stopVision()
    this.stopCloudPoseCoach()
    if (this.completeTimer) {
      clearTimeout(this.completeTimer)
      this.completeTimer = null
    }
  },

  onCameraReady() {
    if (!this.cameraContext) {
      this.cameraContext = wx.createCameraContext()
    }
    this.setData({
      cameraReady: true,
      message: '摄像头已打开，请把身体放进提示框内。',
      visionLabel: '正在识别',
      visionStatus: 'ready'
    })
    this.startVision()
    this.startCloudPoseCoach()
  },

  onCameraError() {
    this.stopVision()
    this.stopCloudPoseCoach()
    this.setData({
      cameraReady: false,
      recognitionActive: false,
      cloudPoseActive: false,
      visionLabel: '相机不可用',
      visionStatus: 'camera-error',
      cloudPoseStatus: 'camera-error',
      cloudPoseLabel: '动作检测暂停',
      message: '无法访问摄像头，请检查权限。'
    })
  },

  startVision() {
    if (!this.cameraContext || !this.cameraContext.onCameraFrame) {
      this.setData({
        recognitionActive: false,
        visionLabel: '暂不支持',
        visionStatus: 'unsupported',
        message: '当前基础库暂不支持实时识别，请先使用下方相机检测。'
      })
      return
    }

    if (this.frameListener) {
      return
    }

    if (this.visionSession) {
      this.visionSession.reset()
    }

    this.lastFrameAt = 0
    this.frameListener = this.cameraContext.onCameraFrame((frame) => {
      const now = Date.now()
      if (now - this.lastFrameAt < FRAME_INTERVAL) {
        return
      }
      this.lastFrameAt = now
      this.handleVisionFrame(frame)
    })

    if (!this.frameListener || !this.frameListener.start) {
      this.frameListener = null
      this.setData({
        recognitionActive: false,
        visionLabel: '暂不支持',
        visionStatus: 'unsupported',
        message: '当前基础库暂不支持实时识别，请先使用下方相机检测。'
      })
      return
    }

    this.frameListener.start()
    this.setData({ recognitionActive: true })
  },

  stopVision() {
    if (this.frameListener) {
      this.frameListener.stop()
      this.frameListener = null
    }
    if (this.data.recognitionActive) {
      this.setData({ recognitionActive: false })
    }
  },

  startCloudPoseCoach() {
    if (!this.cameraContext || this.cloudPoseTimer || this.data.count >= this.data.total || this.data.completing) {
      return
    }

    this.setData({
      cloudPoseActive: true,
      cloudPoseStatus: 'ready',
      cloudPoseLabel: '准备检测',
      cloudPoseAttempts: 0
    })
    this.scheduleCloudPoseCheck(800)
  },

  stopCloudPoseCoach() {
    if (this.cloudPoseTimer) {
      clearTimeout(this.cloudPoseTimer)
      this.cloudPoseTimer = null
    }
    if (this.data.cloudPoseActive || this.data.cloudPoseChecking) {
      this.setData({
        cloudPoseActive: false,
        cloudPoseChecking: false
      })
    }
  },

  scheduleCloudPoseCheck(delay = CLOUD_POSE_INTERVAL) {
    if (this.cloudPoseTimer || !this.data.cameraReady || this.data.count >= this.data.total || !this.data.cloudPoseActive || this.data.completing) {
      return
    }
    this.cloudPoseTimer = setTimeout(() => {
      this.cloudPoseTimer = null
      this.checkCloudPose()
    }, delay)
  },

  takePracticePhoto() {
    return new Promise((resolve, reject) => {
      if (!this.cameraContext || !this.cameraContext.takePhoto) {
        reject(new Error('当前基础库暂不支持拍照检测'))
        return
      }

      this.cameraContext.takePhoto({
        quality: 'low',
        success: (res) => resolve(res.tempImagePath || ''),
        fail: () => reject(new Error('云端姿态抽检拍照失败'))
      })
    })
  },

  async checkCloudPose() {
    if (!this.data.cameraReady || this.data.cloudPoseChecking || this.data.count >= this.data.total || !this.data.cloudPoseActive || this.data.completing) {
      this.scheduleCloudPoseCheck()
      return
    }

    const nextAttempt = Number(this.data.cloudPoseAttempts || 0) + 1
    if (nextAttempt > CLOUD_MAX_ATTEMPTS) {
      this.setData({
        cloudPoseActive: false,
        cloudPoseStatus: 'unsupported',
        cloudPoseLabel: '请重新摆好姿势',
        cloudPoseMessage: '已经快速尝试多次了，请把身体重新放进框里，再继续检测。'
      })
      return
    }
    this.setData({ cloudPoseAttempts: nextAttempt })

    this.setData({
      cloudPoseChecking: true,
      cloudPoseStatus: 'ready',
      cloudPoseLabel: '正在分析'
    })

    try {
      const tempImagePath = await this.takePracticePhoto()
      const uploadResult = await uploadPoseImage(tempImagePath, this.cloudActionKey)
      const record = await analyzePoseImage({
        ...uploadResult,
        actionKey: this.cloudActionKey,
        source: 'trainingPractice',
        trainingLevelId: this.data.level.id
      })
      const feedback = formatCloudPoseFeedback(record, this.cloudActionKey)
      const counted = this.handleCloudPoseCount(feedback)
      this.setData({
        cloudPoseChecking: false,
        cloudPoseStatus: feedback.status,
        cloudPoseLabel: counted ? '动作达标' : feedback.label,
        cloudPoseMessage: counted ? '这次动作达标，已经记作一次有效训练。' : feedback.message,
        cloudPoseAngle: feedback.angleText,
        cloudPoseScore: feedback.scoreText,
        message: counted ? '做得好，这个动作已经达标了。' : feedback.message
      })

      if (counted) {
        this.setData({ cloudPoseAttempts: 0 })
      }
    } catch (error) {
      console.warn('云端姿态抽检失败', error)
      this.setData({
        cloudPoseChecking: false,
        cloudPoseStatus: 'unsupported',
        cloudPoseLabel: '检测失败',
        cloudPoseMessage: '这次检测没有成功，请稍后再试。'
      })
    }

    this.scheduleCloudPoseCheck()
  },

  handleCloudPoseCount(feedback) {
    if (!feedback.shouldCount || this.data.count >= this.data.total || this.data.completing) {
      return false
    }
    const now = Date.now()
    if (now - this.lastCloudCountAt < CLOUD_COUNT_COOLDOWN) {
      return false
    }

    this.lastCloudCountAt = now
    this.addTrainingCount('cloudPose')
    return true
  },

  handleVisionFrame(frame) {
    if (!this.visionSession || this.data.count >= this.data.total || this.data.completing) {
      return
    }

    const result = this.visionSession.analyzeFrame(frame)
    this.setData({
      visionLabel: result.label,
      visionStatus: result.status,
      visionScore: result.score,
      qualityItems: result.qualityItems,
      message: result.message
    })
  },

  simulateCorrect() {
    this.setData({
      message: this.data.level.feedback
    })
  },

  simulateGood() {
    this.addTrainingCount()
  },

  goPoseCamera() {
    if (!this.data.level || this.data.completing) {
      return
    }
    this.stopVision()
    this.stopCloudPoseCoach()
    wx.navigateTo({
      url: `/pages/pose/camera?from=practice&levelId=${this.data.level.id}&actionKey=${this.cloudActionKey}`
    })
  },

  restartCloudPoseCoach() {
    if (this.data.count >= this.data.total || this.data.completing) {
      return
    }
    this.cloudPoseAttempts = 0
    this.setData({
      cloudPoseActive: true,
      cloudPoseChecking: false,
      cloudPoseStatus: 'ready',
      cloudPoseLabel: '继续检测',
      cloudPoseMessage: '请把身体重新放进框里，系统会继续帮您检测。',
      message: '准备好了就继续，系统会快速帮您判断。'
    })
    this.scheduleCloudPoseCheck(600)
  },

  addTrainingCount(source = 'manual') {
    if (!this.data.level || this.data.count >= this.data.total || this.data.completing) {
      return
    }

    const nextCount = Math.min(this.data.count + 1, this.data.total)
    const isComplete = nextCount >= this.data.total

    this.setData({
      count: nextCount,
      progressWidth: `${Math.round((nextCount / this.data.total) * 100)}%`,
      message: isComplete
        ? '做得真棒'
        : source === 'cloudPose'
          ? '动作达标，已经记作一次有效训练。'
          : '做得很好，保持现在的节奏。',
      visionStatus: isComplete ? 'completed' : this.data.visionStatus,
      visionLabel: isComplete ? '本关完成' : this.data.visionLabel,
      cloudPoseStatus: isComplete ? 'completed' : this.data.cloudPoseStatus,
      cloudPoseLabel: isComplete ? '动作完成' : this.data.cloudPoseLabel,
      completing: isComplete,
      completeMessage: isComplete ? (this.data.isFinalLevel ? '恭喜通关' : '做得真棒') : ''
    })

    if (isComplete) {
      this.completeCurrentLevel()
    }
  },

  getVisionMessage(key, fallback) {
    return this.visionRule && this.visionRule.messages && this.visionRule.messages[key]
      ? this.visionRule.messages[key]
      : fallback
  },

  completeCurrentLevel() {
    this.stopVision()
    this.stopCloudPoseCoach()
    completeLevel(this.data.level.id, trainingLevels.length)
    completeCloudLevel(this.data.level.id, trainingLevels.length).catch((error) => {
      console.warn('云端训练进度同步失败，已保留本地缓存', error)
    })
    if (isFinalLevel(this.data.level.id)) {
      wx.showToast({
        title: '恭喜通关',
        icon: 'success',
        duration: 1400
      })
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/training/index' })
      }, 900)
      return
    }
    this.completeTimer = setTimeout(() => {
      this.completeTimer = null
      wx.redirectTo({ url: `/pages/training/learn?id=${this.data.level.id + 1}` })
    }, COMPLETE_DELAY)
  }
})
