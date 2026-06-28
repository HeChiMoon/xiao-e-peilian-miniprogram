const { trainingLevels } = require('../../data/mock')
const { completeLevel } = require('../../utils/storage')
const { completeCloudLevel } = require('../../services/trainingService')
const { uploadPoseImage, analyzePoseImage } = require('../../services/poseService')

const ACTIONS = {
  wallSquat: {
    name: '靠墙静蹲',
    guide: '手机放在身体侧前方约 30 到 45 度，距离约 2.5 到 3 米。请把胸口、髋部、膝盖、脚踝和双脚都拍进画面。',
    frameCopy: '胸口到双脚都要入镜'
  },
  legRaise: {
    name: '直腿抬高',
    guide: '当前只保留坐姿版本。请坐在椅子或床边，从身体侧面拍摄，让髋部、抬起的腿和自然下垂的腿都进入画面。',
    frameCopy: '髋部到双脚都要入镜'
  },
  singleLegStand: {
    name: '单腿站立',
    guide: '请找稳固椅背，手机放在正前方或侧前方，让髋部、膝盖、脚踝和双脚都能看到。',
    frameCopy: '髋膝脚踝和双脚都要入镜'
  }
}

function getPassScore(actionKey) {
  const map = {
    wallSquat: 74,
    legRaise: 70,
    singleLegStand: 72
  }
  return map[actionKey] || 76
}

function getMainAngle(record) {
  const angles = record && record.angles ? record.angles : {}
  return Number(angles.activeKnee || angles.supportKnee || angles.averageKnee) || 0
}

function getIdleStatusText(fromPractice) {
  return fromPractice
    ? '请先摆好动作，把关键部位放进画面，然后点开始检测。'
    : '请摆好动作后点击开始检测。'
}

function getPassStatusText(fromPractice) {
  return fromPractice ? '做得真棒' : '动作达标，这次检测完成了。'
}

function isFinalLevel(levelId) {
  return Number(levelId) >= trainingLevels.length
}

function buildFailureHint(actionKey, detected) {
  if (!detected) {
    if (actionKey === 'legRaise') {
      return '这次没有识别清楚，请从侧面拍摄，并把髋部和双腿都放进画面后再试。'
    }
    if (actionKey === 'wallSquat') {
      return '这次没有识别清楚，请把胸口到双脚完整拍进画面后再试。'
    }
    if (actionKey === 'singleLegStand') {
      return '这次没有识别清楚，请把支撑腿、抬起的腿和双脚都放进画面后再试。'
    }
    return '这次没有识别清楚，请调整拍摄角度后再试。'
  }

  if (actionKey === 'legRaise') {
    return '已经识别到人像，但动作还不够清楚。请确认髋部、膝盖和脚踝没有被遮挡。'
  }

  return '已经识别到人像，但动作还不够清楚。请确认关键关节没有被遮挡。'
}

function formatResult(record, actionKey) {
  if (!record) {
    return null
  }

  const score = Number(record.score) || 0
  const passScore = getPassScore(actionKey)
  const detected = record.engine === 'aliyun-body-posture-v1'
  const angles = record.angles || {}
  const hasUsableAngle = Boolean(angles.activeKnee || angles.supportKnee || angles.averageKnee)

  return {
    ...record,
    angleText: `${getMainAngle(record)}度`,
    scoreText: `${score}分`,
    pass: detected && score >= passScore,
    debugText: detected && hasUsableAngle ? '' : buildFailureHint(actionKey, detected),
    riskClass: record.riskLevel === 'high' ? 'danger' : record.riskLevel === 'middle' ? 'warning' : 'safe'
  }
}

function shouldRetryLegRaise(record) {
  if (!record || record.engine === 'aliyun-body-posture-v1') {
    return false
  }

  const message = String(record.apiError || '')
  return message.includes('未返回可用的人体关键点') || message.includes('没有拿到坐姿抬腿骨架点')
}

function getSwitchCameraText(devicePosition) {
  return devicePosition === 'back' ? '切换到前置视角' : '切换到后置视角'
}

function getCameraLabel(devicePosition) {
  return devicePosition === 'back' ? '后置视角' : '前置视角'
}

Page({
  data: {
    fromPractice: false,
    levelId: 0,
    isFinalLevel: false,
    actionKey: 'wallSquat',
    actionName: ACTIONS.wallSquat.name,
    guide: ACTIONS.wallSquat.guide,
    frameCopy: ACTIONS.wallSquat.frameCopy,
    backButtonText: '返回上一页',
    devicePosition: 'back',
    cameraLabel: getCameraLabel('back'),
    switchCameraText: getSwitchCameraText('back'),
    cameraVisible: true,
    cameraReady: false,
    switchingCamera: false,
    taking: false,
    uploading: false,
    analyzing: false,
    result: null,
    hasAttempted: false,
    failedAttempts: 0,
    statusText: getIdleStatusText(false),
    canFinishPractice: false,
    autoAdvancing: false
  },

  onLoad(query) {
    const actionKey = ACTIONS[query.actionKey] ? query.actionKey : 'wallSquat'
    const levelId = Number(query.levelId || 0)
    const fromPractice = query.from === 'practice'
    const action = ACTIONS[actionKey]

    this.setData({
      fromPractice,
      levelId,
      isFinalLevel: isFinalLevel(levelId),
      actionKey,
      actionName: action.name,
      guide: action.guide,
      frameCopy: action.frameCopy,
      backButtonText: fromPractice ? '返回练习' : '返回上一页',
      devicePosition: 'back',
      cameraLabel: getCameraLabel('back'),
      switchCameraText: getSwitchCameraText('back'),
      cameraVisible: true,
      switchingCamera: false,
      statusText: getIdleStatusText(fromPractice)
    })
  },

  onUnload() {
    if (this.finishTimer) {
      clearTimeout(this.finishTimer)
      this.finishTimer = null
    }
  },

  onReady() {
    this.cameraContext = wx.createCameraContext()
  },

  onCameraReady() {
    if (!this.cameraContext) {
      this.cameraContext = wx.createCameraContext()
    }

    this.setData({
      cameraReady: true,
      switchingCamera: false,
      statusText: '相机已打开。请摆好动作并保持稳定，然后点击开始检测。'
    })
  },

  onCameraError() {
    this.setData({
      cameraReady: false,
      switchingCamera: false,
      statusText: '无法访问摄像头，请检查微信相机权限后重试。'
    })
  },

  toggleDevicePosition() {
    if (this.data.taking || this.data.uploading || this.data.analyzing || this.data.autoAdvancing || this.data.switchingCamera) {
      return
    }

    if (this.finishTimer) {
      clearTimeout(this.finishTimer)
      this.finishTimer = null
    }

    const nextPosition = this.data.devicePosition === 'back' ? 'front' : 'back'

    this.setData({
      devicePosition: nextPosition,
      cameraLabel: getCameraLabel(nextPosition),
      switchCameraText: getSwitchCameraText(nextPosition),
      cameraVisible: false,
      cameraReady: false,
      switchingCamera: true,
      result: null,
      hasAttempted: false,
      failedAttempts: 0,
      canFinishPractice: false,
      autoAdvancing: false,
      statusText: `已切换到${nextPosition === 'back' ? '后置' : '前置'}视角，请重新摆好动作后开始检测。`
    })

    wx.nextTick(() => {
      this.setData({ cameraVisible: true })
      this.cameraContext = wx.createCameraContext()
    })
  },

  takePhoto() {
    if (
      !this.cameraContext ||
      !this.data.cameraReady ||
      this.data.switchingCamera ||
      this.data.taking ||
      this.data.uploading ||
      this.data.analyzing ||
      this.data.autoAdvancing
    ) {
      if (!this.data.cameraReady || this.data.switchingCamera) {
        this.setData({
          statusText: '相机还在准备中，请稍等一下再开始检测。'
        })
      }
      return
    }

    this.setData({
      taking: true,
      result: null,
      hasAttempted: true,
      canFinishPractice: false,
      autoAdvancing: false,
      statusText: '正在拍照检测，请保持动作不要动。'
    })

    this.cameraContext.takePhoto({
      quality: 'normal',
      success: (res) => {
        this.setData({
          taking: false,
          statusText: '拍照完成，正在分析动作。'
        })
        this.uploadAndAnalyze(res.tempImagePath)
      },
      fail: () => {
        this.setData({
          taking: false,
          hasAttempted: true,
          statusText: '拍照失败，请重新摆好动作后再试一次。'
        })
      }
    })
  },

  getRotationContext(tempImagePath) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: tempImagePath,
        success: resolve,
        fail: reject
      })
    })
  },

  rotateTempImage(tempImagePath) {
    return this.getRotationContext(tempImagePath).then((info) => {
      const ctx = wx.createCanvasContext('rotateCanvas', this)
      const outputWidth = info.height
      const outputHeight = info.width

      ctx.clearRect(0, 0, outputWidth, outputHeight)
      ctx.translate(outputWidth / 2, outputHeight / 2)
      ctx.rotate(Math.PI / 2)
      ctx.drawImage(tempImagePath, -info.width / 2, -info.height / 2, info.width, info.height)

      return new Promise((resolve, reject) => {
        ctx.draw(false, () => {
          wx.canvasToTempFilePath({
            canvasId: 'rotateCanvas',
            x: 0,
            y: 0,
            width: outputWidth,
            height: outputHeight,
            destWidth: outputWidth,
            destHeight: outputHeight,
            fileType: 'jpg',
            quality: 1,
            success: (res) => resolve(res.tempFilePath),
            fail: reject
          }, this)
        })
      })
    })
  },

  async analyzeWithTempPath(tempImagePath, sourceTag) {
    const uploadResult = await uploadPoseImage(tempImagePath, this.data.actionKey)
    return analyzePoseImage({
      ...uploadResult,
      actionKey: this.data.actionKey,
      source: sourceTag,
      trainingLevelId: this.data.levelId
    })
  },

  async uploadAndAnalyze(tempImagePath) {
    if (!tempImagePath) {
      this.setData({
        hasAttempted: true,
        statusText: '没有拿到检测图片，请重新拍照。'
      })
      return
    }

    this.setData({
      uploading: true,
      analyzing: false,
      statusText: '图片正在上传，请稍等。'
    })

    try {
      this.setData({
        uploading: false,
        analyzing: true,
        statusText: '正在分析动作，请稍等。'
      })

      let record = await this.analyzeWithTempPath(
        tempImagePath,
        this.data.fromPractice ? 'trainingCamera' : 'poseCamera'
      )

      if (this.data.actionKey === 'legRaise' && shouldRetryLegRaise(record)) {
        this.setData({
          analyzing: true,
          statusText: '第一次没有看清，正在自动调整后再试一次。'
        })
        const rotatedPath = await this.rotateTempImage(tempImagePath)
        record = await this.analyzeWithTempPath(
          rotatedPath,
          this.data.fromPractice ? 'trainingCameraRotated' : 'poseCameraRotated'
        )
      }

      const result = formatResult(record, this.data.actionKey)
      const canFinishPractice = Boolean(this.data.fromPractice && result && result.pass)
      const failedAttempts = result && result.pass ? 0 : Number(this.data.failedAttempts || 0) + 1

      let statusText = ''
      if (result && result.pass) {
        statusText = getPassStatusText(this.data.fromPractice)
      } else if (result && result.debugText) {
        statusText = result.debugText
      } else if (failedAttempts >= 2) {
        statusText = '这次还是没有看清，请调整站位或拍摄角度后再试。'
      } else {
        statusText = '这次没有看清动作，请调整后再试。'
      }

      this.setData({
        uploading: false,
        analyzing: false,
        result,
        hasAttempted: true,
        failedAttempts,
        autoAdvancing: canFinishPractice && !isFinalLevel(this.data.levelId),
        canFinishPractice,
        statusText
      })

      if (canFinishPractice) {
        if (isFinalLevel(this.data.levelId)) {
          this.finishPractice()
        } else {
          this.finishTimer = setTimeout(() => {
            this.finishTimer = null
            this.finishPractice()
          }, 5500)
        }
      }
    } catch (error) {
      console.warn('姿态检测失败', error)
      this.setData({
        uploading: false,
        analyzing: false,
        hasAttempted: true,
        result: null,
        statusText: '这次没有完成检测，请稍等一下再试。'
      })
    }
  },

  finishPractice() {
    if (!this.data.canFinishPractice || !this.data.levelId) {
      return
    }

    const total = trainingLevels.length
    completeLevel(this.data.levelId, total)
    completeCloudLevel(this.data.levelId, total).catch((error) => {
      console.warn('云端训练进度同步失败，已保留本地完成记录', error)
    })

    if (this.data.levelId >= total) {
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

    const nextId = this.data.levelId + 1
    wx.redirectTo({ url: `/pages/training/learn?id=${nextId}` })
  },

  backPractice() {
    wx.navigateBack()
  }
})
