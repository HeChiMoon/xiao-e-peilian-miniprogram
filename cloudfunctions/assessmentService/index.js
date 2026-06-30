const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const collection = db.collection('assessment_reports')

function trimText(value) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

function normalizeReport(report = {}) {
  return {
    score: Number(report.score) || 0,
    level: trimText(report.level) || 'low',
    levelText: trimText(report.levelText) || '低风险',
    summary: trimText(report.summary),
    suggestion: trimText(report.suggestion),
    createdAt: trimText(report.createdAt),
    answers: report.answers && typeof report.answers === 'object' ? report.answers : {},
    dimensionScores: report.dimensionScores && typeof report.dimensionScores === 'object' ? report.dimensionScores : {},
    dimensionStates: report.dimensionStates && typeof report.dimensionStates === 'object' ? report.dimensionStates : {},
    safetyFlags: report.safetyFlags && typeof report.safetyFlags === 'object' ? report.safetyFlags : {
      blocked: false,
      reasons: []
    },
    recommendationProfile: report.recommendationProfile && typeof report.recommendationProfile === 'object' ? report.recommendationProfile : {}
  }
}

async function getCurrentRecord(openid) {
  return collection
    .where({
      ownerOpenId: openid
    })
    .limit(1)
    .get()
}

async function saveLatest(event) {
  const { OPENID } = cloud.getWXContext()
  const input = normalizeReport(event.data && event.data.report)
  const existing = await getCurrentRecord(OPENID)
  const report = {
    ...input,
    ownerOpenId: OPENID,
    updatedAt: db.serverDate()
  }

  if (existing.data.length > 0) {
    const current = existing.data[0]
    await collection.doc(current._id).update({
      data: report
    })
    return {
      success: true,
      data: {
        ...current,
        ...report,
        _id: current._id
      }
    }
  }

  const result = await collection.add({
    data: {
      ...report,
      createdAt: db.serverDate(),
      savedAt: db.serverDate()
    }
  })

  return {
    success: true,
    data: {
      _id: result._id,
      ...report
    }
  }
}

async function getLatest() {
  const { OPENID } = cloud.getWXContext()
  const result = await getCurrentRecord(OPENID)
  if (result.data.length === 0) {
    return {
      success: true,
      data: null
    }
  }

  return {
    success: true,
    data: result.data[0]
  }
}

async function clearLatest() {
  const { OPENID } = cloud.getWXContext()
  const result = await getCurrentRecord(OPENID)
  if (result.data.length > 0) {
    await collection.doc(result.data[0]._id).remove()
  }

  return {
    success: true,
    data: true
  }
}

exports.main = async (event) => {
  try {
    switch (event.action) {
      case 'saveLatest':
        return await saveLatest(event)
      case 'getLatest':
        return await getLatest()
      case 'clearLatest':
        return await clearLatest()
      default:
        return {
          success: false,
          errMsg: `Unknown action: ${event.action}`
        }
    }
  } catch (error) {
    return {
      success: false,
      errMsg: error.message || 'assessmentService failed'
    }
  }
}
