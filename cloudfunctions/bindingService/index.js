const cloud = require('wx-server-sdk')
const QRCode = require('qrcode')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const bindings = db.collection('caregiver_bindings')
const elders = db.collection('elders')
const assessments = db.collection('assessment_reports')
const trainingProgress = db.collection('training_progress')
const poseRecords = db.collection('pose_detection_records')

function createCode() {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `XE-${timestamp}-${random}`
}

async function getCurrentElder(openid) {
  const result = await elders
    .where({
      ownerOpenId: openid
    })
    .limit(1)
    .get()

  return result.data[0] || null
}

async function getLatestRecord(openid) {
  return bindings
    .where({
      ownerOpenId: openid,
      status: 'pending'
    })
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get()
}

async function getLatestOwnerRecord(openid) {
  return bindings
    .where({
      ownerOpenId: openid
    })
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get()
}

async function getOwnedLatest(collection, ownerOpenId, orderField = 'updatedAt') {
  if (!ownerOpenId) {
    return null
  }

  const result = await collection
    .where({
      ownerOpenId
    })
    .orderBy(orderField, 'desc')
    .limit(1)
    .get()

  return result.data[0] || null
}

function buildCaregiverDashboard(elder, report, pose, progress) {
  const completedIds = progress && Array.isArray(progress.completedIds) ? progress.completedIds : []
  const totalLevels = 3

  return {
    elderCard: {
      name: elder && elder.name ? elder.name : '未命名老人',
      age: elder && elder.age ? elder.age : '',
      healthLevel: elder && elder.healthLevel ? elder.healthLevel : '待完善',
      painAreas: elder && elder.painAreas ? elder.painAreas : '',
      note: elder && elder.note ? elder.note : ''
    },
    assessmentCard: report ? {
      status: 'done',
      title: '最近测评',
      primary: `${report.levelText || '已完成'} · ${Number(report.score) || 0}分`,
      secondary: report.summary || '已生成最近一次测评结果。'
    } : {
      status: 'empty',
      title: '最近测评',
      primary: '暂未测评',
      secondary: '老人端完成一次测评后，这里会同步显示结果。'
    },
    poseCard: pose ? {
      status: 'done',
      title: '最近检测',
      primary: `${pose.actionName || '姿势检测'} · ${Number(pose.score) || 0}分`,
      secondary: pose.riskText || pose.suggestion || '已完成最近一次检测。'
    } : {
      status: 'empty',
      title: '最近检测',
      primary: '暂未检测',
      secondary: '老人端完成一次相机检测后，这里会同步显示结果。'
    },
    trainingCard: {
      status: completedIds.length > 0 ? 'done' : 'empty',
      title: '今日训练',
      primary: `${completedIds.length}/${totalLevels} 个动作`,
      secondary: completedIds.length > 0
        ? `已完成：${completedIds.join('、')}`
        : '老人端开始每日练后，这里会同步显示进度。'
    }
  }
}

async function getCaregiverDashboard(record) {
  const elder = record && record.elderId
    ? await elders.doc(record.elderId).get().then((res) => res.data).catch(() => null)
    : null

  const ownerOpenId = record && record.ownerOpenId ? record.ownerOpenId : ''
  const report = await getOwnedLatest(assessments, ownerOpenId, 'updatedAt').catch(() => null)
  const pose = await getOwnedLatest(poseRecords, ownerOpenId, 'updatedAt').catch(() => null)
  const progress = await getOwnedLatest(trainingProgress, ownerOpenId, 'updatedAt').catch(() => null)

  return {
    elder,
    dashboard: buildCaregiverDashboard(elder, report, pose, progress)
  }
}

async function buildQrAssets(bindingCode) {
  try {
    const qrBuffer = await QRCode.toBuffer(bindingCode, {
      type: 'png',
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 1000,
      color: {
        dark: '#111111',
        light: '#FFFFFF'
      }
    })

    const cloudPath = `binding-qrcodes/${bindingCode}.png`
    const uploadResult = await cloud.uploadFile({
      cloudPath,
      fileContent: qrBuffer
    })

    const tempResult = await cloud.getTempFileURL({
      fileList: [uploadResult.fileID]
    })

    const tempItem = tempResult.fileList && tempResult.fileList[0]

    return {
      qrFileID: uploadResult.fileID,
      qrCloudPath: cloudPath,
      qrImageUrl: tempItem && tempItem.tempFileURL ? tempItem.tempFileURL : ''
    }
  } catch (error) {
    throw new Error(`生成普通二维码失败: ${error.message || error}`)
  }
}

async function ensureQrAssets(record) {
  if (!record || !record.bindingCode) {
    return {
      ...record,
      qrImageUrl: ''
    }
  }

  if (record.qrVersion === 'text-v1' && record.qrFileID) {
    return refreshQrImageUrl(record)
  }

  const qrAssets = await buildQrAssets(record.bindingCode)

  await bindings.doc(record._id).update({
    data: {
      qrFileID: qrAssets.qrFileID,
      qrCloudPath: qrAssets.qrCloudPath,
      qrVersion: 'text-v1',
      updatedAt: db.serverDate()
    }
  })

  return {
    ...record,
    qrFileID: qrAssets.qrFileID,
    qrCloudPath: qrAssets.qrCloudPath,
    qrVersion: 'text-v1',
    qrImageUrl: qrAssets.qrImageUrl
  }
}

async function refreshQrImageUrl(record) {
  if (!record || !record.qrFileID) {
    return {
      ...record,
      qrImageUrl: ''
    }
  }

  const tempResult = await cloud.getTempFileURL({
    fileList: [record.qrFileID]
  })
  const tempItem = tempResult.fileList && tempResult.fileList[0]

  return {
    ...record,
    qrImageUrl: tempItem && tempItem.tempFileURL ? tempItem.tempFileURL : ''
  }
}

async function createBindingCode() {
  const { OPENID } = cloud.getWXContext()
  const elder = await getCurrentElder(OPENID)
  const bindingCode = createCode()
  const qrPayload = JSON.stringify({
    type: 'xiao-e-caregiver-binding',
    bindingCode,
    elderName: elder ? elder.name : ''
  })
  const qrAssets = await buildQrAssets(bindingCode)

  const data = {
    ownerOpenId: OPENID,
    elderId: elder ? elder._id : '',
    elderName: elder ? elder.name : '',
    bindingCode,
    qrPayload,
    qrFileID: qrAssets.qrFileID,
    qrCloudPath: qrAssets.qrCloudPath,
    qrVersion: 'text-v1',
    status: 'pending',
    caregiverOpenId: '',
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  }

  const result = await bindings.add({ data })

  return {
    success: true,
    data: {
      _id: result._id,
      ...data,
      qrImageUrl: qrAssets.qrImageUrl
    }
  }
}

async function getLatest() {
  const { OPENID } = cloud.getWXContext()
  const result = await getLatestRecord(OPENID)
  if (result.data.length === 0) {
    return {
      success: true,
      data: null
    }
  }

  return {
    success: true,
    data: await ensureQrAssets(result.data[0])
  }
}

async function getOwnerBindingStatus() {
  const { OPENID } = cloud.getWXContext()
  const result = await getLatestOwnerRecord(OPENID)
  if (result.data.length === 0) {
    return {
      success: true,
      data: null
    }
  }

  const record = result.data[0]
  return {
    success: true,
    data: record.status === 'pending' ? await ensureQrAssets(record) : record
  }
}

async function confirmBinding(event) {
  const { OPENID } = cloud.getWXContext()
  const bindingCode = String(event.data && event.data.bindingCode || '').trim()
  if (!bindingCode) {
    return {
      success: false,
      errMsg: '请输入绑定码'
    }
  }

  const result = await bindings
    .where({
      bindingCode,
      status: 'pending'
    })
    .limit(1)
    .get()

  if (result.data.length === 0) {
    return {
      success: false,
      errMsg: '绑定码不存在或已被使用'
    }
  }

  const record = result.data[0]
  await bindings.doc(record._id).update({
    data: {
      status: 'bound',
      caregiverOpenId: OPENID,
      updatedAt: db.serverDate()
    }
  })

  const detail = await getCaregiverDashboard(record)

  return {
    success: true,
    data: {
      ...record,
      status: 'bound',
      caregiverOpenId: OPENID,
      elder: detail.elder,
      dashboard: detail.dashboard
    }
  }
}

async function getCaregiverBinding() {
  const { OPENID } = cloud.getWXContext()
  const result = await bindings
    .where({
      caregiverOpenId: OPENID,
      status: 'bound'
    })
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get()

  if (result.data.length === 0) {
    return {
      success: true,
      data: null
    }
  }

  const record = result.data[0]
  const detail = await getCaregiverDashboard(record)

  return {
    success: true,
    data: {
      ...record,
      elder: detail.elder,
      dashboard: detail.dashboard
    }
  }
}

async function removeBindingsByQuery(query) {
  let removed = 0

  while (true) {
    const result = await bindings.where(query).limit(100).get()
    const ids = result.data.map((item) => item._id).filter(Boolean)
    if (!ids.length) {
      break
    }

    await Promise.all(ids.map((id) => bindings.doc(id).remove().catch(() => null)))
    removed += ids.length

    if (ids.length < 100) {
      break
    }
  }

  return removed
}

async function clearMine() {
  const { OPENID } = cloud.getWXContext()
  const ownerRemoved = await removeBindingsByQuery({ ownerOpenId: OPENID })
  const caregiverRemoved = await removeBindingsByQuery({ caregiverOpenId: OPENID })

  return {
    success: true,
    data: {
      removed: ownerRemoved + caregiverRemoved
    }
  }
}

exports.main = async (event) => {
  try {
    switch (event.action) {
      case 'createBindingCode':
        return await createBindingCode()
      case 'getLatest':
        return await getLatest()
      case 'getOwnerBindingStatus':
        return await getOwnerBindingStatus()
      case 'confirmBinding':
        return await confirmBinding(event)
      case 'getCaregiverBinding':
        return await getCaregiverBinding()
      case 'clearMine':
        return await clearMine()
      default:
        return {
          success: false,
          errMsg: `Unknown action: ${event.action}`
        }
    }
  } catch (error) {
    return {
      success: false,
      errMsg: error.message || 'bindingService failed'
    }
  }
}
