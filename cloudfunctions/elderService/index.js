const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const collection = db.collection('elders')

function trimText(value) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeProfile(profile = {}) {
  const name = trimText(profile.name)
  const gender = trimText(profile.gender) || '男'
  const birthYear = toNumber(profile.birthYear)
  const age = toNumber(profile.age)

  return {
    name,
    gender,
    birthYear,
    age,
    healthLevel: trimText(profile.healthLevel) || '良好',
    avatar: trimText(profile.avatar) || '/assets/images/goose-main.png',
    phone: trimText(profile.phone),
    medicalHistory: trimText(profile.medicalHistory),
    painAreas: trimText(profile.painAreas),
    emergencyContact: trimText(profile.emergencyContact),
    height: trimText(profile.height),
    weight: trimText(profile.weight),
    note: trimText(profile.note)
  }
}

function getMissingFields(profile) {
  const required = ['name', 'gender', 'birthYear', 'age']
  const optional = ['phone', 'medicalHistory', 'painAreas', 'emergencyContact', 'height', 'weight', 'note']
  const missing = required.filter((field) => profile[field] === '' || profile[field] === null || typeof profile[field] === 'undefined')
  return missing.concat(optional.filter((field) => profile[field] === '' || profile[field] === null || typeof profile[field] === 'undefined'))
}

async function getCurrentProfile(openid) {
  return collection
    .where({
      ownerOpenId: openid
    })
    .limit(1)
    .get()
}

async function createOrUpdate(event) {
  const { OPENID } = cloud.getWXContext()
  const input = normalizeProfile(event.data && event.data.profile)
  const existing = await getCurrentProfile(OPENID)
  const profile = {
    ...input,
    ownerOpenId: OPENID,
    profileComplete: getMissingFields(input).length === 0,
    missingFields: getMissingFields(input),
    updatedAt: db.serverDate()
  }

  if (existing.data.length > 0) {
    const current = existing.data[0]
    await collection.doc(current._id).update({
      data: profile
    })
    return {
      success: true,
      data: {
        ...current,
        ...profile,
        _id: current._id
      }
    }
  }

  const result = await collection.add({
    data: {
      ...profile,
      createdAt: db.serverDate()
    }
  })

  return {
    success: true,
    data: {
      _id: result._id,
      ...profile
    }
  }
}

async function get() {
  const { OPENID } = cloud.getWXContext()
  const result = await getCurrentProfile(OPENID)
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

async function deleteMine() {
  const { OPENID } = cloud.getWXContext()
  const existing = await getCurrentProfile(OPENID)
  if (existing.data.length > 0) {
    await collection.doc(existing.data[0]._id).remove()
  }

  return {
    success: true,
    data: true
  }
}

exports.main = async (event) => {
  try {
    switch (event.action) {
      case 'createOrUpdate':
        return await createOrUpdate(event)
      case 'get':
        return await get()
      case 'deleteMine':
        return await deleteMine()
      default:
        return {
          success: false,
          errMsg: `Unknown action: ${event.action}`
        }
    }
  } catch (error) {
    return {
      success: false,
      errMsg: error.message || 'elderService failed'
    }
  }
}
