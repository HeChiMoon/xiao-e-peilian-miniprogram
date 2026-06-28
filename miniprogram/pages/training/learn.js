const { trainingLevels } = require('../../data/mock')

const MEDIA_CACHE_VERSION = '20260531-v1'

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

function resolveTrainingMedia(pathValue) {
  if (!pathValue) {
    return {
      packagePath: '',
      displaySrc: ''
    }
  }

  const normalized = String(pathValue).replace(/\\/g, '/')
  const fileName = normalized.split('/').pop()

  if (
    normalized.indexOf('/pages/training/assets/') === 0 ||
    normalized.indexOf('/assets/videos/training/') === 0 ||
    normalized.indexOf('/assets/images/training/') === 0
  ) {
    return {
      packagePath: `pages/training/assets/${fileName}`,
      displaySrc: `assets/${fileName}`
    }
  }

  return {
    packagePath: normalized.replace(/^\//, ''),
    displaySrc: normalized
  }
}

function normalizeLevel(level) {
  if (!level) {
    return null
  }

  const video = resolveTrainingMedia(level.video)
  const image = resolveTrainingMedia(level.image)

  return {
    ...level,
    video: video.displaySrc,
    videoPackagePath: video.packagePath,
    image: image.displaySrc
  }
}

function copyPackagedVideoToUserPath(packagePath, levelId) {
  if (!packagePath) {
    return Promise.resolve('')
  }

  const normalized = String(packagePath).replace(/\\/g, '/').replace(/^\//, '')
  const userDir = `${wx.env.USER_DATA_PATH}/training-cache-${MEDIA_CACHE_VERSION}`
  const targetPath = `${userDir}/${MEDIA_CACHE_VERSION}-level-${levelId}.mp4`
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
    level: null,
    showDialog: false,
    hasVideo: false,
    preparingMedia: false
  },

  async onLoad(query) {
    const id = Number(query.id || 1)
    const level = normalizeLevel(trainingLevels.find((item) => item.id === id) || trainingLevels[0])

    this.setData({
      level,
      hasVideo: Boolean(level && level.video),
      preparingMedia: Boolean(level && level.video)
    })

    if (level && level.videoPackagePath) {
      const playableSrc = await copyPackagedVideoToUserPath(level.videoPackagePath, level.id)
      this.setData({
        'level.video': playableSrc || level.video,
        preparingMedia: false
      })
      return
    }

    this.setData({ preparingMedia: false })
  },

  replayVideo() {
    if (!this.data.hasVideo) {
      wx.showToast({ title: '这个动作是图片示范', icon: 'none' })
      return
    }

    const ctx = wx.createVideoContext('learnVideo', this)
    ctx.seek(0)
    ctx.play()
  },

  notYet() {
    this.replayVideo()
    wx.showToast({ title: '再看一遍，别着急', icon: 'none' })
  },

  understood() {
    this.setData({ showDialog: true })
  },

  closeDialog() {
    this.setData({ showDialog: false })
  },

  noop() {},

  startPractice() {
    wx.navigateTo({ url: `/pages/training/practice?id=${this.data.level.id}` })
  }
})
