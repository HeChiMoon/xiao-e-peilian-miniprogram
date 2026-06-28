const { videoItems } = require('../../data/mock')
const {
  getTrainingProgress,
  getAssessment,
  getElderProfile,
  getVideoState,
  saveVideoState
} = require('../../utils/storage')
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
const QUICK_COMMENTS = ['讲得清楚', '这个实用', '准备收藏', '想给家里人看']
const COMMENT_AUTHORS = ['王阿姨', '李叔叔', '张阿姨', '陪练家属']
const COMMENT_TIMES = ['刚刚', '1分钟前', '3分钟前', '5分钟前']

function normalizeVideoStateMap(savedState) {
  const next = {}
  const source = savedState && typeof savedState === 'object' ? savedState : {}

  Object.keys(source).forEach((key) => {
    const item = source[key] || {}
    next[key] = {
      liked: Boolean(item.liked),
      saved: Boolean(item.saved),
      extraComments: Array.isArray(item.extraComments)
        ? item.extraComments.map((text) => String(text || '').trim()).filter(Boolean).slice(-12)
        : []
    }
  })

  return next
}

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

function buildCommentItem(videoId, text, index) {
  const author = COMMENT_AUTHORS[index % COMMENT_AUTHORS.length]
  return {
    id: `${videoId}-comment-${index}`,
    author,
    avatarText: author.slice(0, 1),
    timeText: COMMENT_TIMES[index % COMMENT_TIMES.length],
    text: String(text || '').trim()
  }
}

function decorateVideo(item, state) {
  const baseLikes = Number(item.baseLikes != null ? item.baseLikes : item.likes) || 0
  const baseSaves = Number(item.baseSaves != null ? item.baseSaves : item.saves) || 0
  const baseComments = Array.isArray(item.baseComments)
    ? item.baseComments
    : (Array.isArray(item.comments) ? item.comments : [])
  const localState = state || {}
  const extraComments = Array.isArray(localState.extraComments) ? localState.extraComments : []
  const mergedComments = baseComments.concat(extraComments)

  return {
    ...item,
    baseLikes,
    baseSaves,
    baseComments,
    liked: Boolean(localState.liked),
    saved: Boolean(localState.saved),
    likeCount: baseLikes + (localState.liked ? 1 : 0),
    saveCount: baseSaves + (localState.saved ? 1 : 0),
    commentCount: mergedComments.length,
    commentItems: mergedComments.map((text, index) => buildCommentItem(item.id, text, index))
  }
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
    currentRank: '',
    currentVideoId: '',
    showComments: false,
    commentDraft: '',
    commentItems: [],
    commentVideoTitle: '',
    quickComments: QUICK_COMMENTS,
    actionIcons: {
      like: '/assets/icons/video-like.svg',
      save: '/assets/icons/video-save.svg',
      comment: '/assets/icons/video-comment.svg'
    }
  },

  onLoad() {
    this.videoContexts = {}
    this.videoStateMap = normalizeVideoStateMap(getVideoState())
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

  applyVideoState(items) {
    return (Array.isArray(items) ? items : []).map((item) => decorateVideo(item, this.videoStateMap[item.id]))
  },

  persistVideoState() {
    saveVideoState(this.videoStateMap)
  },

  refreshVideoState() {
    const videos = this.applyVideoState(this.data.videos || [])
    const current = videos[this.data.currentIndex] || {}

    this.setData({
      videos,
      commentItems: Array.isArray(current.commentItems) ? current.commentItems : [],
      commentVideoTitle: current.title || ''
    }, () => {
      this.syncCurrentMeta()
    })
  },

  async refresh() {
    const baseVideos = this.applyVideoState(normalizeVideos(recommendVideoItems(videoItems, this.context || {})))
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
      currentRank: current.recommended ? String(current.recommendRank || '') : '',
      currentVideoId: current.id || '',
      commentItems: Array.isArray(current.commentItems) ? current.commentItems : [],
      commentVideoTitle: current.title || ''
    })
  },

  onSwiperChange(event) {
    const currentIndex = Number(event.detail.current || 0)
    this.setData({
      currentIndex,
      showComments: false,
      commentDraft: ''
    }, () => {
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
  },

  noop() {},

  updateVideoState(videoId, updater, toastTitle) {
    if (!videoId) {
      return
    }

    const currentState = this.videoStateMap[videoId] || { liked: false, saved: false, extraComments: [] }
    const nextState = updater({
      liked: Boolean(currentState.liked),
      saved: Boolean(currentState.saved),
      extraComments: Array.isArray(currentState.extraComments) ? currentState.extraComments.slice() : []
    })

    this.videoStateMap = {
      ...this.videoStateMap,
      [videoId]: {
        liked: Boolean(nextState.liked),
        saved: Boolean(nextState.saved),
        extraComments: Array.isArray(nextState.extraComments) ? nextState.extraComments.slice(-12) : []
      }
    }

    this.persistVideoState()
    this.refreshVideoState()

    if (toastTitle) {
      wx.showToast({
        title: toastTitle,
        icon: 'none'
      })
    }
  },

  toggleLike(event) {
    const { id } = event.currentTarget.dataset
    const nextLiked = !(this.videoStateMap[id] && this.videoStateMap[id].liked)
    this.updateVideoState(id, (state) => ({
      ...state,
      liked: nextLiked
    }), nextLiked ? '已点赞' : '已取消点赞')
  },

  toggleSave(event) {
    const { id } = event.currentTarget.dataset
    const nextSaved = !(this.videoStateMap[id] && this.videoStateMap[id].saved)
    this.updateVideoState(id, (state) => ({
      ...state,
      saved: nextSaved
    }), nextSaved ? '已收藏' : '已取消收藏')
  },

  openComments(event) {
    const { id } = event.currentTarget.dataset
    const current = (this.data.videos || []).find((item) => item.id === id) || {}
    this.setData({
      currentVideoId: id || current.id || '',
      commentItems: Array.isArray(current.commentItems) ? current.commentItems : [],
      commentVideoTitle: current.title || '',
      showComments: true
    })
  },

  closeComments() {
    this.setData({
      showComments: false,
      commentDraft: ''
    })
  },

  onCommentInput(event) {
    this.setData({
      commentDraft: event.detail.value || ''
    })
  },

  fillQuickComment(event) {
    const { text } = event.currentTarget.dataset
    this.setData({
      commentDraft: String(text || '')
    })
  },

  submitComment() {
    const videoId = this.data.currentVideoId
    const comment = String(this.data.commentDraft || '').trim()

    if (!videoId) {
      return
    }

    if (!comment) {
      wx.showToast({
        title: '先写一句再发送',
        icon: 'none'
      })
      return
    }

    this.updateVideoState(videoId, (state) => ({
      ...state,
      extraComments: (state.extraComments || []).concat(comment)
    }))

    this.setData({
      commentDraft: '',
      showComments: true
    })

    wx.showToast({
      title: '留言成功',
      icon: 'none'
    })
  }
})
