const { getPoseDetectionDetail } = require('../../services/poseService')

function formatTime(value) {
  if (!value) return '最近记录'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '最近记录'
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}月${day}日 ${hour}:${minute}`
}

function formatAngle(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? `${number}°` : '暂无'
}

function formatRecord(record) {
  if (!record) {
    return null
  }

  const standard = record.standard || {}
  return {
    ...record,
    timeText: formatTime(record.createdAt),
    leftAngleText: formatAngle(record.angles && record.angles.leftKnee),
    rightAngleText: formatAngle(record.angles && record.angles.rightKnee),
    averageAngleText: formatAngle(record.angles && record.angles.averageKnee),
    scoreText: record.detected ? `${Number(record.score) || 0}分` : '这次未看清',
    standardText: standard.minAngle && standard.maxAngle ? `${standard.minAngle}°-${standard.maxAngle}°` : '暂无标准',
    idealText: standard.idealAngle ? `${standard.idealAngle}°` : '暂无',
    riskClass: record.riskLevel === 'high' ? 'danger' : record.riskLevel === 'middle' ? 'warning' : 'safe',
    hasKeypoints: record.detected && Array.isArray(record.keypoints) && record.keypoints.length > 0
  }
}

function buildCompare(record, previous) {
  if (!record || !previous || !record.detected || !previous.detected) {
    return {
      hasPrevious: false,
      scoreDeltaText: '暂无上一条',
      angleDeltaText: '暂无上一条'
    }
  }

  const scoreDelta = (Number(record.score) || 0) - (Number(previous.score) || 0)
  const currentAngle = Number(record.angles && record.angles.averageKnee) || 0
  const previousAngle = Number(previous.angles && previous.angles.averageKnee) || 0
  const angleDelta = currentAngle - previousAngle

  return {
    hasPrevious: true,
    previousTimeText: formatTime(previous.createdAt),
    scoreDeltaText: `${scoreDelta >= 0 ? '+' : ''}${scoreDelta}分`,
    angleDeltaText: `${angleDelta >= 0 ? '+' : ''}${angleDelta}°`,
    scoreDeltaClass: scoreDelta >= 0 ? 'up' : 'down',
    angleDeltaClass: Math.abs(angleDelta) <= 8 ? 'stable' : angleDelta > 0 ? 'up' : 'down'
  }
}

Page({
  data: {
    loading: true,
    record: null,
    previous: null,
    compare: buildCompare(null, null),
    errorText: ''
  },

  onLoad(options) {
    this.recordId = options && options.id
    this.loadDetail()
  },

  async loadDetail() {
    if (!this.recordId) {
      this.setData({
        loading: false,
        errorText: '没有找到这条检测记录，请返回历史页后重试。'
      })
      return
    }

    this.setData({ loading: true, errorText: '' })
    const detail = await getPoseDetectionDetail(this.recordId)
    const record = formatRecord(detail.record)
    const previous = formatRecord(detail.previous)

    if (!record) {
      this.setData({
        loading: false,
        errorText: '没有找到这条检测记录，请返回历史页后重试。'
      })
      return
    }

    this.setData({
      loading: false,
      record,
      previous,
      compare: buildCompare(detail.record, detail.previous)
    })

    setTimeout(() => {
      this.drawPoseCanvas(record.keypoints)
    }, 100)
  },

  drawPoseCanvas(keypoints) {
    if (!Array.isArray(keypoints) || keypoints.length === 0) {
      return
    }

    const points = keypoints.reduce((map, point) => {
      map[point.name] = point
      return map
    }, {})
    const pairs = [
      ['left_hip', 'left_knee'],
      ['left_knee', 'left_ankle'],
      ['right_hip', 'right_knee'],
      ['right_knee', 'right_ankle'],
      ['left_hip', 'right_hip']
    ]
    const width = 320
    const height = 220
    const ctx = wx.createCanvasContext('poseDetailCanvas', this)

    ctx.setFillStyle('#F7F5F0')
    ctx.fillRect(0, 0, width, height)
    ctx.setStrokeStyle('#88C9A1')
    ctx.setLineWidth(5)
    ctx.setLineCap('round')

    pairs.forEach((pair) => {
      const start = points[pair[0]]
      const end = points[pair[1]]
      if (!start || !end) {
        return
      }
      ctx.beginPath()
      ctx.moveTo(start.x * width, start.y * height)
      ctx.lineTo(end.x * width, end.y * height)
      ctx.stroke()
    })

    Object.keys(points).forEach((name) => {
      const point = points[name]
      if (name.indexOf('hip') < 0 && name.indexOf('knee') < 0 && name.indexOf('ankle') < 0) {
        return
      }
      ctx.beginPath()
      ctx.setFillStyle(name.indexOf('knee') >= 0 ? '#F4A882' : '#3F3F3F')
      ctx.arc(point.x * width, point.y * height, 7, 0, Math.PI * 2)
      ctx.fill()
    })

    ctx.draw()
  },

  retry() {
    this.loadDetail()
  },

  goHistory() {
    wx.navigateBack()
  },

  goTraining() {
    wx.redirectTo({ url: '/pages/training/index' })
  }
})
