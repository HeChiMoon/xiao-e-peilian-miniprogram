const DEFAULT_CONFIG = {
  minBrightness: 34,
  maxBrightness: 238,
  minContrast: 13,
  maxMotion: 0.2,
  minQualityScore: 72,
  stableFrames: 3,
  countCooldownMs: 2400,
  messages: {}
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function normalizeConfig(config = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    messages: {
      ...DEFAULT_CONFIG.messages,
      ...(config.messages || {})
    }
  }
}

function getMessage(config, key, fallback) {
  return config.messages && config.messages[key] ? config.messages[key] : fallback
}

function getLuma(data, index) {
  return (data[index] * 299 + data[index + 1] * 587 + data[index + 2] * 114) / 1000
}

function summarizeSamples(frame) {
  const width = Number(frame && frame.width) || 0
  const height = Number(frame && frame.height) || 0
  if (!frame || !frame.data || width <= 0 || height <= 0) {
    return null
  }

  const data = new Uint8Array(frame.data)
  const stepX = Math.max(8, Math.floor(width / 32))
  const stepY = Math.max(8, Math.floor(height / 32))
  const samples = []
  const centerSamples = []
  let sum = 0
  let min = 255
  let max = 0

  for (let y = Math.floor(stepY / 2); y < height; y += stepY) {
    for (let x = Math.floor(stepX / 2); x < width; x += stepX) {
      const index = (y * width + x) * 4
      const luma = getLuma(data, index)
      samples.push(luma)
      sum += luma
      min = Math.min(min, luma)
      max = Math.max(max, luma)

      if (x > width * 0.24 && x < width * 0.76 && y > height * 0.12 && y < height * 0.9) {
        centerSamples.push(luma)
      }
    }
  }

  const count = samples.length || 1
  const avg = sum / count
  const contrast = getContrast(samples)
  const centerContrast = getContrast(centerSamples)

  return {
    width,
    height,
    samples,
    brightness: avg,
    contrast,
    centerContrast,
    range: max - min
  }
}

function getContrast(samples) {
  if (!samples.length) {
    return 0
  }

  const sum = samples.reduce((total, value) => total + value, 0)
  const avg = sum / samples.length
  const variance = samples.reduce((total, value) => total + Math.pow(value - avg, 2), 0) / samples.length
  return Math.sqrt(variance)
}

function getMotionScore(current, previous) {
  if (!current || !previous || current.width !== previous.width || current.height !== previous.height) {
    return 0
  }

  const length = Math.min(current.samples.length, previous.samples.length)
  if (!length) {
    return 0
  }

  let diff = 0
  for (let index = 0; index < length; index += 1) {
    diff += Math.abs(current.samples[index] - previous.samples[index])
  }

  return clamp(diff / length / 255, 0, 1)
}

function buildQualityItems(metrics, score, config) {
  const lightScore = clamp(Math.round((1 - Math.abs(metrics.brightness - 128) / 128) * 100), 0, 100)
  const contrastScore = clamp(Math.round(metrics.contrast * 4), 0, 100)
  const stableScore = clamp(Math.round((1 - metrics.motionScore / config.maxMotion) * 100), 0, 100)

  return [
    {
      label: '光线',
      value: `${lightScore}%`,
      state: lightScore >= 55 ? 'ok' : 'warn'
    },
    {
      label: '轮廓',
      value: `${contrastScore}%`,
      state: contrastScore >= 50 ? 'ok' : 'warn'
    },
    {
      label: '稳定',
      value: `${stableScore}%`,
      state: stableScore >= 55 ? 'ok' : 'warn'
    },
    {
      label: '综合',
      value: `${score}%`,
      state: score >= 72 ? 'ok' : 'warn'
    }
  ]
}

function classify(metrics, state, config) {
  const lightScore = clamp((1 - Math.abs(metrics.brightness - 128) / 128) * 100, 0, 100)
  const contrastScore = clamp(metrics.contrast * 4, 0, 100)
  const centerScore = clamp(metrics.centerContrast * 4.5, 0, 100)
  const stableScore = clamp((1 - metrics.motionScore / config.maxMotion) * 100, 0, 100)
  const score = Math.round(lightScore * 0.26 + contrastScore * 0.28 + centerScore * 0.22 + stableScore * 0.24)
  const qualityItems = buildQualityItems(metrics, score, config)

  if (metrics.brightness < config.minBrightness) {
    state.goodStreak = 0
    return {
      status: 'low-light',
      label: '光线偏暗',
      message: getMessage(config, 'lowLight', '请打开房间灯光，身体尽量站在明亮位置。'),
      score,
      shouldCount: false,
      qualityItems
    }
  }

  if (metrics.brightness > config.maxBrightness) {
    state.goodStreak = 0
    return {
      status: 'too-bright',
      label: '画面过亮',
      message: getMessage(config, 'tooBright', '请避开强光或窗户直射，保持全身清楚可见。'),
      score,
      shouldCount: false,
      qualityItems
    }
  }

  if (metrics.contrast < config.minContrast && metrics.centerContrast < config.minContrast) {
    state.goodStreak = 0
    return {
      status: 'no-body',
      label: '未识别到身体',
      message: getMessage(config, 'noBody', '请后退一步，把头、肩、膝盖尽量放进绿色框内。'),
      score,
      shouldCount: false,
      qualityItems
    }
  }

  if (metrics.motionScore > config.maxMotion) {
    state.goodStreak = 0
    return {
      status: 'unstable',
      label: '动作太快',
      message: getMessage(config, 'unstable', '动作放慢一点，保持身体稳定，小鹅才能看清楚。'),
      score,
      shouldCount: false,
      qualityItems
    }
  }

  state.goodStreak += 1
  const ready = state.goodStreak >= config.stableFrames && score >= config.minQualityScore
  const now = Date.now()
  const shouldCount = ready && now - state.lastCountAt >= config.countCooldownMs

  if (shouldCount) {
    state.lastCountAt = now
  }

  return {
    status: ready ? 'qualified' : 'ready',
    label: ready ? '识别达标' : '正在校准',
    message: ready
      ? getMessage(config, 'qualified', '姿态和画面稳定，保持这个节奏。')
      : getMessage(config, 'ready', '已经看到您了，请保持慢一点、稳一点。'),
    score,
    shouldCount,
    qualityItems
  }
}

function createVisionSession(options = {}) {
  const config = normalizeConfig(options)
  const state = {
    previous: null,
    goodStreak: 0,
    lastCountAt: 0
  }

  return {
    reset() {
      state.previous = null
      state.goodStreak = 0
      state.lastCountAt = 0
    },

    analyzeFrame(frame) {
      const summary = summarizeSamples(frame)
      if (!summary) {
        return {
          status: 'waiting',
          label: '等待相机',
          message: '正在打开摄像头，请稍等。',
          score: 0,
          shouldCount: false,
          qualityItems: []
        }
      }

      const motionScore = getMotionScore(summary, state.previous)
      state.previous = summary

      return classify({
        brightness: summary.brightness,
        contrast: summary.contrast,
        centerContrast: summary.centerContrast,
        range: summary.range,
        motionScore
      }, state, config)
    }
  }
}

module.exports = {
  createVisionSession
}
