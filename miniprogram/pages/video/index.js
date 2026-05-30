const { videoItems } = require('../../data/mock')
const { getTrainingProgress, getAssessment, getElderProfile } = require('../../utils/storage')
const { getCloudElderProfile } = require('../../services/elderService')
const { getCloudAssessmentReport } = require('../../services/assessmentService')
const { getCloudTrainingProgress } = require('../../services/trainingService')
const { getLatestPoseDetection } = require('../../services/poseService')
const { recommendVideoItems } = require('../../utils/recommendation')

const DEFAULT_PROFILE = {
  name: '',
  age: '',
  healthLevel: '待完善',
  avatar: '/assets/images/goose-main.png'
}

const MEDIA_CACHE_VERSION = '20260530-v2'

function resolveVideoSrc(src) {
  if (!src) {
    return {
      packagePath: '',
      displaySrc: ''
    }
  }
  const normalized = String(src).replace(/\\/g, '/')
  const fileName = normalized.split('/').pop()
  if (normalized.indexOf('/pages/video/assets/') === 0 || normalized.indexOf('/assets/videos/science/') === 0) {
    return {
      packagePath: `pages/video/assets/${fileName}`,
      displaySrc: `pages/video/assets/${fileName}`
    }
  }
  return {
    packagePath: normalized.replace(/^\//, ''),
    displaySrc: normalized
  }
}

function normalizeVideos(items) {
  return (Array.isArray(items) ? items : []).map((item, index) => {
    const media = resolveVideoSrc(item.src)
    return {
      ...item,
      id: item.id || `video-${index + 1}`,
      src: media.displaySrc,
      packagePath: media.packagePath,
      poster: item.poster || '/assets/images/goose-main.png'
    }
  })
}

function buildIntro(videos) {
  const top = Array.isArray(videos) && videos.length > 0 ? videos[0] : null
  if (!top) {
    return {
      title: '今天先看看科普视频',
      copy: '先了解膝关节保护和训练注意事项，再开始练习会更安心。'
    }
  }

  return {
    title: `推荐先看：${top.title}`,
    copy: top.recommendReason || '这是根据当前状态优先推荐的内容。'
  }
}

function ensureDir(dirPath) {
  const fs = wx.getFileSystemManager()
  return new Promise((resolve) => {
    fs.mkdir({
      dirPath,
      recursive: true,
      success: () => resolve(),
      fail: () => resolve()
    })
  })
}

function accessFile(filePath) {
  const fs = wx.getFileSystemManager()
  return new Promise((resolve) => {
    fs.access({
      path: filePath,
      success: () => resolve(true),
      fail: () => resolve(false)
    })
  })
}

function copyPackagedVideoToUserPath(packagePath, targetName) {
  if (!packagePath) {
    return Promise.resolve('')
  }
  const normalized = String(packagePath).replace(/\\/g, '/').replace(/^\//, '')
  const userDir = `${wx.env.USER_DATA_PATH}/video-cache-${MEDIA_CACHE_VERSION}`
  const targetPath = `${userDir}/${MEDIA_CACHE_VERSION}-${targetName}`
  const fs = wx.getFileSystemManager()

  return ensureDir(userDir)
    .then(() => accessFile(targetPath))
    .then((exists) => {
      if (exists) {
        return targetPath
      }
      return new Promise((resolve) => {
        fs.copyFile({
          srcPath: normalized,
          destPath: targetPath,
          success: () => resolve(targetPath),
          fail: () => resolve(`/${normalized}`)
        })
      })
    })
}

Page({
  data: {
    videos: [],
    intro: buildIntro([]),
    preparingMedia: false,
    currentIndex: 0,
    currentTitle: '',
    currentDesc: '',
    currentReason: '',
    currentRank: ''
  },

  onLoad() {
    this.videoContexts = {}
    this.context = {
      profile: getElderProfile(DEFAULT_PROFILE),
      report: getAssessment(),
      progress: getTrainingProgress(),
      pose: null
    }
    this.refresh()
    this.loadRecommendationContext()
  },

  onUnload() {
    this.pauseAllVideos()
  },

  async refresh() {
    const baseVideos = normalizeVideos(recommendVideoItems(videoItems, this.context || {}))
    this.setData({
      videos: baseVideos,
      intro: buildIntro(baseVideos),
      preparingMedia: true
    })

    const videos = await Promise.all(
      baseVideos.map(async (item) => {
        const localSrc = await copyPackagedVideoToUserPath(item.packagePath, `${item.id}.mp4`)
        return {
          ...item,
          src: localSrc || item.src
        }
      })
    )

    const nextIndex = Math.min(this.data.currentIndex || 0, Math.max(videos.length - 1, 0))
    this.setData({
      videos,
      intro: buildIntro(videos),
      preparingMedia: false,
      currentIndex: nextIndex
    }, () => {
      this.syncCurrentMeta()
      this.playCurrentVideo()
    })
  },

  async loadRecommendationContext() {
    const results = await Promise.all([
      getCloudElderProfile(DEFAULT_PROFILE),
      getCloudAssessmentReport(),
      getCloudTrainingProgress(),
      getLatestPoseDetection()
    ])

    this.context = {
      profile: results[0] || this.context.profile,
      report: results[1] || this.context.report,
      progress: results[2] || this.context.progress,
      pose: results[3] || null
    }
    this.refresh()
  },

  getVideoContext(index) {
    const key = `video-${index}`
    if (!this.videoContexts[key]) {
      this.videoContexts[key] = wx.createVideoContext(key, this)
    }
    return this.videoContexts[key]
  },

  pauseAllVideos() {
    const list = Array.isArray(this.data.videos) ? this.data.videos : []
    list.forEach((_, index) => {
      const ctx = this.getVideoContext(index)
      if (ctx && ctx.pause) {
        ctx.pause()
      }
    })
  },

  playCurrentVideo() {
    if (this.data.preparingMedia) {
      return
    }
    const index = Number(this.data.currentIndex) || 0
    const current = this.data.videos[index]
    if (!current || !current.src) {
      return
    }
    setTimeout(() => {
      this.pauseAllVideos()
      const ctx = this.getVideoContext(index)
      if (ctx && ctx.play) {
        ctx.play()
      }
    }, 80)
  },

  syncCurrentMeta() {
    const current = (this.data.videos || [])[this.data.currentIndex] || {}
    this.setData({
      currentTitle: current.title || '',
      currentDesc: current.desc || '',
      currentReason: current.recommendReason || '',
      currentRank: current.recommended ? String(current.recommendRank || '') : ''
    })
  },

  onSwiperChange(event) {
    const currentIndex = Number(event.detail.current || 0)
    this.setData({ currentIndex }, () => {
      this.syncCurrentMeta()
      this.playCurrentVideo()
    })
  },

  toggleCurrentVideo() {
    const index = Number(this.data.currentIndex) || 0
    const ctx = this.getVideoContext(index)
    if (!ctx) {
      return
    }
    if (this._videoPaused) {
      ctx.play()
      this._videoPaused = false
      return
    }
    ctx.pause()
    this._videoPaused = true
  },

  onVideoPlay() {
    this._videoPaused = false
  },

  onVideoPause() {
    this._videoPaused = true
  },

  onVideoEnded() {
    const index = Number(this.data.currentIndex) || 0
    const ctx = this.getVideoContext(index)
    if (ctx && ctx.seek && ctx.play) {
      ctx.seek(0)
      ctx.play()
    }
  },

  onVideoError() {
    wx.showToast({
      title: '视频加载失败，请下滑重试',
      icon: 'none'
    })
  }
})
