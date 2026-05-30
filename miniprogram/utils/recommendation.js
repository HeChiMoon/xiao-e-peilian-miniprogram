function textHas(value, keywords) {
  const text = String(value || '')
  return keywords.some((keyword) => text.indexOf(keyword) >= 0)
}

function getReportRisk(report) {
  if (!report) return 'unknown'
  const level = String(report.level || report.levelText || '').toLowerCase()
  const score = Number(report.score) || 0
  if (level.indexOf('high') >= 0 || level.indexOf('高') >= 0 || score >= 24) return 'high'
  if (level.indexOf('middle') >= 0 || level.indexOf('中') >= 0 || level.indexOf('关注') >= 0 || score >= 12) return 'middle'
  return 'low'
}

function getPoseRisk(pose) {
  if (!pose) return 'unknown'
  if (pose.riskLevel === 'high') return 'high'
  if (pose.riskLevel === 'middle') return 'middle'
  return 'low'
}

function hasPainSignal(profile, report, pose) {
  const profileText = [
    profile && profile.medicalHistory,
    profile && profile.painAreas,
    profile && profile.note,
    profile && profile.healthLevel,
    report && report.summary,
    report && report.suggestion,
    pose && pose.suggestion
  ].join(' ')
  return textHas(profileText, ['疼', '痛', '肿', '僵', '关节炎', '受限', '摔倒'])
}

function scoreVideo(video, context) {
  const profile = context.profile || {}
  const reportRisk = getReportRisk(context.report)
  const poseRisk = getPoseRisk(context.pose)
  const progress = context.progress || { completedIds: [] }
  const completedCount = Array.isArray(progress.completedIds) ? progress.completedIds.length : 0
  const age = Number(profile.age) || 0
  const pain = hasPainSignal(profile, context.report, context.pose)

  let score = 10
  const reasons = []

  if (video.id === 'v1') {
    score += 8
    reasons.push('适合先了解日常保护')
    if (age >= 70 || pain || reportRisk === 'high' || poseRisk === 'high') {
      score += 18
      reasons.push('更适合当前的防护需求')
    }
    if (reportRisk === 'high' || poseRisk === 'high') {
      score += 10
    }
  }

  if (video.id === 'v2') {
    score += 10
    reasons.push('训练前先热身更稳妥')
    if (completedCount === 0 || reportRisk === 'middle' || poseRisk === 'middle') {
      score += 14
      reasons.push('适合开始今日训练前观看')
    }
    if (reportRisk === 'low' && poseRisk !== 'high') {
      score += 6
    }
  }

  if (video.id === 'v3') {
    score += 7
    reasons.push('训练后放松能减轻不适')
    if (completedCount > 0) {
      score += 18
      reasons.push('您今天已经有训练记录，适合做放松')
    }
    if (pain) {
      score += 8
    }
  }

  if (video.id === 'v4') {
    score += 9
    reasons.push('适合先看日常护膝方法')
    if (age >= 68 || pain || reportRisk !== 'low') {
      score += 14
      reasons.push('更适合当前阶段的日常活动保护')
    }
  }

  if (video.id === 'v5') {
    score += 9
    reasons.push('适合不舒服时先看一看')
    if (pain || poseRisk === 'high' || reportRisk === 'high') {
      score += 16
      reasons.push('现在更需要先了解疼痛期怎么安排活动')
    }
  }

  return {
    score,
    reason: reasons[reasons.length - 1] || '适合作为今日科普内容'
  }
}

function recommendVideoItems(items, context = {}) {
  const scored = items.map((item, originalIndex) => {
    const result = scoreVideo(item, context)
    return {
      ...item,
      recommendScore: result.score,
      recommendReason: result.reason,
      recommended: false,
      originalIndex
    }
  }).sort((a, b) => {
    if (b.recommendScore !== a.recommendScore) return b.recommendScore - a.recommendScore
    return a.originalIndex - b.originalIndex
  })

  return scored.map((item, index) => ({
    ...item,
    recommended: index < 3,
    recommendRank: index + 1
  }))
}

function getRecommendedVideoPreview(items, context = {}) {
  return recommendVideoItems(items, context)[0] || null
}

module.exports = {
  recommendVideoItems,
  getRecommendedVideoPreview
}
