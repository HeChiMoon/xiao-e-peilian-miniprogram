const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const elders = db.collection('elders')
const bindings = db.collection('caregiver_bindings')

async function getLatestElder(openid) {
  const result = await elders
    .where({
      ownerOpenId: openid
    })
    .limit(1)
    .get()

  return result.data[0] || null
}

async function getLatestCaregiverBinding(openid) {
  const result = await bindings
    .where({
      caregiverOpenId: openid,
      status: 'bound'
    })
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get()

  return result.data[0] || null
}

async function getLatestOwnerBinding(openid) {
  const result = await bindings
    .where({
      ownerOpenId: openid
    })
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get()

  return result.data[0] || null
}

async function getSessionState() {
  const { OPENID } = cloud.getWXContext()

  const [elder, caregiverBinding, ownerBinding] = await Promise.all([
    getLatestElder(OPENID),
    getLatestCaregiverBinding(OPENID),
    getLatestOwnerBinding(OPENID)
  ])

  return {
    success: true,
    data: {
      openid: OPENID,
      elder: elder ? {
        exists: true,
        id: elder._id,
        name: elder.name || '',
        profileComplete: Boolean(elder.profileComplete)
      } : {
        exists: false
      },
      caregiver: caregiverBinding ? {
        exists: true,
        id: caregiverBinding._id,
        elderName: caregiverBinding.elderName || ''
      } : {
        exists: false
      },
      ownerBinding: ownerBinding ? {
        exists: true,
        status: ownerBinding.status || '',
        elderName: ownerBinding.elderName || ''
      } : {
        exists: false
      }
    }
  }
}

exports.main = async (event) => {
  try {
    switch (event.action) {
      case 'getSessionState':
        return await getSessionState()
      default:
        return {
          success: false,
          errMsg: `Unknown action: ${event.action}`
        }
    }
  } catch (error) {
    return {
      success: false,
      errMsg: error.message || 'authService failed'
    }
  }
}
