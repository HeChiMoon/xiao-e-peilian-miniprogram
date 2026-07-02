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

const QUICK_COMMENTS = ['讲得清楚', '这个实用', '准备收藏', '想给家里人看']
const COMMENT_AUTHORS = ['王阿姨', '李叔叔', '张阿姨', '陪练家属']
const COMMENT_TIMES = ['刚刚', '1分钟前', '3分钟前', '5分钟前']

function normalizeStateMap(savedState) {
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

function buildCommentItem(itemId, text, index) {
  const author = COMMENT_AUTHORS[index % COMMENT_AUTHORS.length]
  return {
    id: `${itemId}-comment-${index}`,
    author,
    avatarText: author.slice(0, 1),
    timeText: COMMENT_TIMES[index % COMMENT_TIMES.length],
    text: String(text || '').trim()
  }
}

function decorateItem(item, state) {
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
    image: item.image || '/assets/images/goose-main.png',
    points: Array.isArray(item.points) ? item.points : [],
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

function buildIntro(items) {
  const top = Array.isArray(items) && items.length > 0 ? items[0] : null
  if (!top) {
    return {
      title: '今天先看一点护膝小知识',
      copy: '先了解日常保护和训练注意事项，再开始练习会更安心。'
    }
  }

  return {
    title: `推荐先看：${top.title}`,
    copy: top.recommendReason || '这是根据当前状态优先推荐的健康知识。'
  }
}

Page({
  data: {
    items: [],
    intro: buildIntro([]),
    currentItemId: '',
    showComments: false,
    commentDraft: '',
    commentItems: [],
    commentItemTitle: '',
    quickComments: QUICK_COMMENTS,
    actionIcons: {
      like: '/assets/icons/knowledge-like.svg',
      save: '/assets/icons/knowledge-save.svg',
      comment: '/assets/icons/knowledge-comment.svg'
    }
  },

  onLoad() {
    this.stateMap = normalizeStateMap(getVideoState())
    this.context = {
      profile: getElderProfile(DEFAULT_PROFILE),
      report: getAssessment(),
      progress: getTrainingProgress(),
      pose: null
    }
    this.refresh()
    this.loadRecommendationContext()
  },

  decorateItems(items) {
    return (Array.isArray(items) ? items : []).map((item) => decorateItem(item, this.stateMap[item.id]))
  },

  persistState() {
    saveVideoState(this.stateMap)
  },

  refreshState() {
    const items = this.decorateItems(this.data.items || [])
    const current = items.find((item) => item.id === this.data.currentItemId) || {}

    this.setData({
      items,
      commentItems: Array.isArray(current.commentItems) ? current.commentItems : [],
      commentItemTitle: current.title || ''
    })
  },

  refresh() {
    const baseItems = this.decorateItems(recommendVideoItems(videoItems, this.context || {}))
    this.setData({
      items: baseItems,
      intro: buildIntro(baseItems)
    })
  },

  async loadRecommendationContext() {
    const results = await Promise.allSettled([
      getCloudElderProfile(DEFAULT_PROFILE),
      getCloudAssessmentReport(),
      getCloudTrainingProgress(),
      getLatestPoseDetection()
    ])

    const values = results.map((result) => result.status === 'fulfilled' ? result.value : null)
    this.context = {
      profile: values[0] || this.context.profile,
      report: values[1] || this.context.report,
      progress: values[2] || this.context.progress,
      pose: values[3] || null
    }
    this.refresh()
  },

  noop() {},

  updateState(itemId, updater, toastTitle) {
    if (!itemId) {
      return
    }

    const currentState = this.stateMap[itemId] || { liked: false, saved: false, extraComments: [] }
    const nextState = updater({
      liked: Boolean(currentState.liked),
      saved: Boolean(currentState.saved),
      extraComments: Array.isArray(currentState.extraComments) ? currentState.extraComments.slice() : []
    })

    this.stateMap = {
      ...this.stateMap,
      [itemId]: {
        liked: Boolean(nextState.liked),
        saved: Boolean(nextState.saved),
        extraComments: Array.isArray(nextState.extraComments) ? nextState.extraComments.slice(-12) : []
      }
    }

    this.persistState()
    this.refreshState()

    if (toastTitle) {
      wx.showToast({
        title: toastTitle,
        icon: 'none'
      })
    }
  },

  toggleLike(event) {
    const { id } = event.currentTarget.dataset
    const nextLiked = !(this.stateMap[id] && this.stateMap[id].liked)
    this.updateState(id, (state) => ({
      ...state,
      liked: nextLiked
    }), nextLiked ? '已点赞' : '已取消')
  },

  toggleSave(event) {
    const { id } = event.currentTarget.dataset
    const nextSaved = !(this.stateMap[id] && this.stateMap[id].saved)
    this.updateState(id, (state) => ({
      ...state,
      saved: nextSaved
    }), nextSaved ? '已收藏' : '已取消')
  },

  openComments(event) {
    const { id } = event.currentTarget.dataset
    const current = (this.data.items || []).find((item) => item.id === id) || {}
    this.setData({
      currentItemId: id || current.id || '',
      commentItems: Array.isArray(current.commentItems) ? current.commentItems : [],
      commentItemTitle: current.title || '',
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
    const itemId = this.data.currentItemId
    const comment = String(this.data.commentDraft || '').trim()

    if (!itemId) {
      return
    }

    if (!comment) {
      wx.showToast({
        title: '先写一句再发送',
        icon: 'none'
      })
      return
    }

    this.updateState(itemId, (state) => ({
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
