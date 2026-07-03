const DEFAULT_SHARE = {
  title: '\u8d77\u6b65\u8f7b\u76c8\uff1a\u966a\u7238\u5988\u8f7b\u677e\u7ec3\u819d\u5173\u8282',
  path: '/pages/role/index',
  imageUrl: '/assets/images/goose-main.png'
}

function enableShareMenu() {
  if (!wx.showShareMenu) {
    return
  }

  wx.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  })
}

function buildShareMessage(options = {}) {
  return {
    ...DEFAULT_SHARE,
    ...options
  }
}

function buildTimelineShare(options = {}) {
  return {
    title: options.title || DEFAULT_SHARE.title,
    query: options.query || '',
    imageUrl: options.imageUrl || DEFAULT_SHARE.imageUrl
  }
}

module.exports = {
  enableShareMenu,
  buildShareMessage,
  buildTimelineShare
}
