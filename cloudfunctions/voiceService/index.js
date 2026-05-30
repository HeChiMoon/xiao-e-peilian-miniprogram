const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const http = require('http')
const https = require('https')

function getTransport(url) {
  return String(url || '').startsWith('http://') ? http : https
}

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const ttsAudioCache = db.collection('tts_audio_cache')

const DASHSCOPE_API_KEY = String(process.env.DASHSCOPE_API_KEY || '').trim()
function normalizeDashScopeBaseURL(value) {
  const raw = String(value || 'https://dashscope.aliyuncs.com/api/v1').trim()
  if (!raw) {
    return 'https://dashscope.aliyuncs.com/api/v1'
  }

  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    const apiIndex = parsed.pathname.indexOf('/api/v1')
    const pathname = apiIndex >= 0 ? parsed.pathname.slice(0, apiIndex + '/api/v1'.length) : '/api/v1'
    return `${parsed.origin}${pathname}`.replace(/\/$/, '')
  } catch (error) {
    return 'https://dashscope.aliyuncs.com/api/v1'
  }
}

const DASHSCOPE_BASE_URL = normalizeDashScopeBaseURL(process.env.DASHSCOPE_BASE_URL)
const CHAT_MODEL = String(process.env.DASHSCOPE_CHAT_MODEL || 'qwen3.6-flash').trim()
const ASR_MODEL = String(process.env.DASHSCOPE_ASR_MODEL || 'paraformer-v2').trim()
const TTS_MODEL = String(process.env.DASHSCOPE_TTS_MODEL || 'cosyvoice-v3-flash').trim()

function normalizeTTSVoice(model, voice) {
  const modelName = String(model || '').trim()
  const voiceName = String(voice || '').trim()

  if (/^cosyvoice-v3/i.test(modelName)) {
    if (!voiceName || voiceName === 'longxiaochun' || voiceName === 'longxiaochun_v2') {
      return 'longanyang'
    }
    return voiceName
  }

  if (/^cosyvoice-v2/i.test(modelName)) {
    if (!voiceName || voiceName === 'longxiaochun') {
      return 'longxiaochun_v2'
    }
    return voiceName
  }

  return voiceName || 'longanyang'
}

const TTS_VOICE = normalizeTTSVoice(TTS_MODEL, process.env.DASHSCOPE_TTS_VOICE)

function getFallbackTTSVoice(model) {
  const modelName = String(model || '').trim()
  if (/^cosyvoice-v3/i.test(modelName)) {
    return 'longanyang'
  }
  if (/^cosyvoice-v2/i.test(modelName)) {
    return 'longxiaochun_v2'
  }
  return 'longanyang'
}

function normalizeEndpoint(value, fallback) {
  const raw = String(value || fallback || '').trim()
  return raw
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .trim()
}

const ALIYUN_OSS_ENDPOINT = normalizeEndpoint(
  process.env.ALIYUN_OSS_ENDPOINT,
  'oss-cn-shanghai.aliyuncs.com'
)
const ALIYUN_OSS_BUCKET = String(process.env.ALIYUN_OSS_BUCKET || '').trim()
const ALIYUN_OSS_PREFIX = String(process.env.ALIYUN_OSS_PREFIX || 'xiao-e-voice').trim()

function hasDashScopeConfig() {
  return Boolean(DASHSCOPE_API_KEY)
}

function getAliyunAccessKeyId() {
  return process.env.ALIYUN_ACCESS_KEY_ID || ''
}

function getAliyunAccessKeySecret() {
  return process.env.ALIYUN_ACCESS_KEY_SECRET || ''
}

function hasAliyunOssConfig() {
  return Boolean(getAliyunAccessKeyId() && getAliyunAccessKeySecret() && ALIYUN_OSS_BUCKET && ALIYUN_OSS_ENDPOINT)
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function nowMs() {
  return Date.now()
}

function elapsedSince(start) {
  return Date.now() - start
}

function createTiming() {
  return {
    qwenMs: 0,
    ttsCacheMs: 0,
    ttsMs: 0,
    ttsDownloadUploadMs: 0,
    tempUrlMs: 0,
    totalMs: 0
  }
}

function requestJSON(url, options = {}) {
  const body = options.body ? JSON.stringify(options.body) : ''
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
    ...(options.headers || {})
  }

  if (body) {
    headers['Content-Length'] = Buffer.byteLength(body)
  }

  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: options.method || 'POST',
      headers,
      timeout: options.timeout || 20000
    }, (response) => {
      let raw = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        raw += chunk
      })
      response.on('end', () => {
        let payload = {}
        try {
          payload = raw ? JSON.parse(raw) : {}
        } catch (error) {
          reject(new Error(`DashScope 返回非 JSON：${raw.slice(0, 160)}`))
          return
        }

        if (response.statusCode >= 400 || payload.code) {
          reject(new Error(payload.message || payload.code || `DashScope HTTP ${response.statusCode}`))
          return
        }

        resolve(payload)
      })
    })

    request.on('timeout', () => {
      reject(new Error('DashScope 请求超时'))
      request.destroy()
    })
    request.on('error', reject)
    if (body) {
      request.write(body)
    }
    request.end()
  })
}

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      timeout: 15000
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        getJSON(response.headers.location).then(resolve).catch(reject)
        return
      }
      let raw = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        raw += chunk
      })
      response.on('end', () => {
        try {
          resolve(raw ? JSON.parse(raw) : {})
        } catch (error) {
          reject(new Error(`转写结果不是 JSON：${raw.slice(0, 160)}`))
        }
      })
    }).on('timeout', function onTimeout() {
      reject(new Error('读取转写结果超时'))
      this.destroy()
    }).on('error', reject)
  })
}

function downloadBufferFromURL(url, maxBytes = 12 * 1024 * 1024, options = {}) {
  const transport = getTransport(url)
  return new Promise((resolve, reject) => {
    transport.get(url, {
      timeout: 15000,
      headers: options.headers || {}
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadBufferFromURL(response.headers.location, maxBytes, options).then(resolve).catch(reject)
        return
      }

      if (response.statusCode === 401 || response.statusCode === 403) {
        reject(new Error(`DashScope TTS 音频下载鉴权失败：HTTP ${response.statusCode}`))
        response.resume()
        return
      }

      if (response.statusCode !== 200) {
        reject(new Error(`下载录音失败：HTTP ${response.statusCode}`))
        response.resume()
        return
      }

      const chunks = []
      let total = 0
      response.on('data', (chunk) => {
        total += chunk.length
        if (total > maxBytes) {
          response.destroy(new Error('录音文件超过 12MB，请缩短提问后再试'))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
    }).on('timeout', function onTimeout() {
      reject(new Error('下载录音超时'))
      this.destroy()
    }).on('error', reject)
  })
}

function percentEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/'/g, '%27')
}

function encodeOssObjectKey(objectKey) {
  return String(objectKey).split('/').map(encodeURIComponent).join('/')
}

function createOssSignature(method, contentType, dateOrExpires, objectKey) {
  const canonicalResource = `/${ALIYUN_OSS_BUCKET}/${objectKey}`
  const stringToSign = `${method}\n\n${contentType || ''}\n${dateOrExpires}\n${canonicalResource}`
  return crypto
    .createHmac('sha1', getAliyunAccessKeySecret())
    .update(stringToSign)
    .digest('base64')
}

function extractXmlMessage(raw) {
  const matched = String(raw || '').match(/<Message>([\s\S]*?)<\/Message>/)
  return matched ? matched[1] : String(raw || '').slice(0, 200)
}

function getAudioContentType(cloudPath) {
  const lower = String(cloudPath || '').toLowerCase()
  if (lower.endsWith('.mp3')) return 'audio/mpeg'
  if (lower.endsWith('.aac')) return 'audio/aac'
  if (lower.endsWith('.wav')) return 'audio/wav'
  if (lower.endsWith('.m4a')) return 'audio/mp4'
  return 'application/octet-stream'
}

function getAudioSuffix(cloudPath) {
  const matched = String(cloudPath || '').toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/)
  return matched && ['aac', 'mp3', 'wav', 'pcm', 'm4a'].includes(matched[1]) ? matched[1] : 'mp3'
}

function createTTSCacheKey(speechText) {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify({
      speechText: String(speechText || '').trim(),
      model: TTS_MODEL,
      voice: TTS_VOICE
    }))
    .digest('hex')
}

function buildTTSCloudPath(audioURL) {
  return `tts-audio/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${getAudioSuffix(audioURL)}`
}

async function uploadAudioToCloudStorage(audioURL, timing = createTiming()) {
  if (!audioURL) {
    return {
      audioUrl: '',
      audioFileID: '',
      audioCloudPath: '',
      ttsSource: ''
    }
  }

  const transferStart = nowMs()
  const buffer = await downloadBufferFromURL(audioURL, 12 * 1024 * 1024, {
    headers: {
      Authorization: `Bearer ${DASHSCOPE_API_KEY}`
    }
  })
  const cloudPath = buildTTSCloudPath(audioURL)
  const result = await cloud.uploadFile({
    cloudPath,
    fileContent: buffer
  })
  if (!result || !result.fileID) {
    throw new Error('TTS audio upload to WeChat cloud storage failed')
  }
  timing.ttsDownloadUploadMs += elapsedSince(transferStart)

  const tempUrlStart = nowMs()
  const tempURL = await getTempFileURL(result.fileID)
  timing.tempUrlMs += elapsedSince(tempUrlStart)
  return {
    audioUrl: tempURL,
    audioFileID: result.fileID,
    audioCloudPath: cloudPath,
    ttsSource: 'wechat-cloud'
  }
}

function buildOssObjectKey(cloudPath) {
  return `${ALIYUN_OSS_PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${getAudioSuffix(cloudPath)}`
}

function uploadBufferToOss(buffer, objectKey, contentType) {
  const hostname = `${ALIYUN_OSS_BUCKET}.${ALIYUN_OSS_ENDPOINT}`
  const date = new Date().toUTCString()
  const signature = createOssSignature('PUT', contentType, date, objectKey)
  const path = `/${encodeOssObjectKey(objectKey)}`

  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname,
      path,
      method: 'PUT',
      headers: {
        Date: date,
        Host: hostname,
        Authorization: `OSS ${getAliyunAccessKeyId()}:${signature}`,
        'Content-Type': contentType,
        'Content-Length': buffer.length
      },
      timeout: 15000
    }, (response) => {
      let raw = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        raw += chunk
      })
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve()
          return
        }
        reject(new Error(`OSS 上传录音失败：${response.statusCode} ${extractXmlMessage(raw)}`))
      })
    })

    request.on('timeout', () => {
      reject(new Error('OSS 上传录音超时'))
      request.destroy()
    })
    request.on('error', reject)
    request.write(buffer)
    request.end()
  })
}

function createSignedOssURL(objectKey, ttlSeconds = 900) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds
  const signature = createOssSignature('GET', '', expires, objectKey)
  const path = encodeOssObjectKey(objectKey)
  return `https://${ALIYUN_OSS_BUCKET}.${ALIYUN_OSS_ENDPOINT}/${path}?OSSAccessKeyId=${percentEncode(getAliyunAccessKeyId())}&Expires=${expires}&Signature=${percentEncode(signature)}`
}

function extractTextFromQwen(payload) {
  const output = payload.output || {}
  const choices = output.choices || []
  const first = choices[0] || {}
  const message = first.message || {}
  const content = message.content

  if (typeof content === 'string') {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content.map((item) => {
      if (typeof item === 'string') return item
      return item.text || item.content || ''
    }).join('').trim()
  }

  if (output.text) {
    return String(output.text).trim()
  }

  return ''
}

function fallbackAnswer(question) {
  const text = String(question || '')
  if (text.includes('疼') || text.includes('痛') || text.includes('肿')) {
    return '爷爷奶奶，如果膝盖疼痛或肿胀，先停一下，别硬撑。可以休息、少走一点，看看会不会缓解。要是疼得久、越来越重，或者走路受影响，就尽快去医院。'
  }
  if (text.includes('怎么练') || text.includes('运动') || text.includes('锻炼')) {
    return '爷爷奶奶，建议从轻一点的动作开始，慢慢来。直腿抬高、踝泵、短时间散步都可以先试一小会儿，做的时候以舒服、稳定为主。'
  }
  if (text.includes('吃') || text.includes('饮食')) {
    return '爷爷奶奶，饮食上可以多注意优质蛋白、钙、维生素D，还有新鲜蔬果。体重别一下子涨太多，膝关节会轻松一些。'
  }
  return '爷爷奶奶，我可以陪您做膝关节健康科普和训练提醒，但不能代替医生看病。您可以直接问我膝盖疼、怎么练、或者练的时候要注意什么。'
}

function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[。！？!?；;])/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function trimToLength(text, maxLength) {
  const value = String(text || '').trim()
  if (value.length <= maxLength) {
    return value
  }
  const slice = value.slice(0, maxLength)
  const lastBreak = Math.max(
    slice.lastIndexOf('。'),
    slice.lastIndexOf('！'),
    slice.lastIndexOf('？'),
    slice.lastIndexOf('；'),
    slice.lastIndexOf('，')
  )
  return slice.slice(0, lastBreak > 36 ? lastBreak + 1 : maxLength).trim()
}

function buildSpeechText(answerText) {
  const sentences = splitSentences(answerText)
  if (sentences.length === 0) {
    return ''
  }

  let speechText = ''
  for (const sentence of sentences.slice(0, 3)) {
    if ((speechText + sentence).length > 100 && speechText.length >= 40) {
      break
    }
    speechText += sentence
    if (speechText.length >= 70) {
      break
    }
  }

  return trimToLength(speechText || sentences[0], 100)
}

function normalizeHistory(history = []) {
  if (!Array.isArray(history)) {
    return []
  }

  return history.slice(-8).map((item) => {
    const role = item.role === 'ai' || item.role === 'assistant' ? 'assistant' : 'user'
    const text = String(item.text || item.content || '').trim()
    return text ? { role, content: text.slice(0, 400) } : null
  }).filter(Boolean)
}

function buildMessages(question, history = []) {
  return [
    {
      role: 'system',
      content: [
        '你是“小鹅”，膝关节健康小百科，在社区给中老年人做科普。',
        '你的知识领域包括：膝关节炎常识、居家训练动作、疼痛应对、饮食保养、日常防护、训练安全提醒。',
        '文字回答可以完整说明，但前 2 到 3 句要适合直接语音播报：先给核心建议，短句、口语、不要铺垫太长。',
        '回答目标：把问题说透，不凑字数。先给核心建议，再简单解释为什么；能给步骤就给步骤，能给注意事项就说清楚。',
        '说话风格：用“爷爷奶奶”开头，像唠家常；短句、口语，但内容要扎实、有信息量；不吓唬人，多用“别着急”“慢慢来”“先停一下看看”。',
        '安全边界：不诊断、不开药、不承诺疗效，不替代医生。遇到持续疼痛、明显肿胀、无法走路、摔倒、发热、关节变形、突然剧痛等危险情况，要温和提醒及时就医。',
        '如果用户问得很宽，比如“膝关节炎是什么”，可以用 4 到 7 句讲清楚：是什么、为什么会疼、常见表现、日常怎么保护、什么时候看医生。',
        '如果用户问“怎么办”或“怎么练”，先安抚，再给可操作建议，比如暂停、观察、冷敷或热敷的场景区别、减少上下楼、选择低冲击训练、疼痛加重就停止。'
      ].join('\n')
    },
    {
      role: 'user',
      content: '什么是膝关节炎？'
    },
    {
      role: 'assistant',
      content: '爷爷奶奶，膝关节炎可以简单理解为膝盖里面的“缓冲垫”和周围组织变得不太舒服了。年纪增长、体重偏大、以前受过伤、长期上下楼多，都可能让膝盖更容易疼。常见表现是走路疼、上下楼疼、蹲起费劲，有的人还会觉得僵硬或肿胀。平时要少做猛蹲、爬很多楼、长时间跪着这类动作，训练要选慢一点、稳一点、低冲击的。别着急，保护好膝盖、坚持合适训练，很多不舒服是可以慢慢管理的。'
    },
    {
      role: 'user',
      content: '膝盖疼怎么办？'
    },
    {
      role: 'assistant',
      content: '爷爷奶奶，先别硬撑，今天可以先把训练停一停。疼的时候少上下楼、少蹲起，让膝盖休息一下；如果是刚活动后酸疼，可以先观察，别马上加量。平时练习要从轻动作开始，比如踝泵、坐姿抬腿、短时间散步，做完不加重疼痛才算合适。要是疼痛持续好几天、明显肿胀、走路受影响，或者突然疼得厉害，就尽快去医院看看。'
    },
    ...normalizeHistory(history),
    {
      role: 'user',
      content: question
    }
  ]
}

async function getTempFileURL(fileID) {
  const result = await cloud.getTempFileURL({ fileList: [fileID] })
  const file = result.fileList && result.fileList[0]
  if (!file || !file.tempFileURL) {
    throw new Error('无法生成录音临时访问链接')
  }
  return file.tempFileURL
}

async function getASRFileURL(fileID, cloudPath) {
  const wechatURL = await getTempFileURL(fileID)
  if (!hasAliyunOssConfig()) {
    return {
      fileURL: wechatURL,
      source: 'wechat-temp-url',
      ossObjectKey: ''
    }
  }

  const audioBuffer = await downloadBufferFromURL(wechatURL)
  const objectKey = buildOssObjectKey(cloudPath)
  await uploadBufferToOss(audioBuffer, objectKey, getAudioContentType(cloudPath))

  return {
    fileURL: createSignedOssURL(objectKey),
    source: 'aliyun-oss',
    ossObjectKey: objectKey
  }
}

async function submitASRTask(fileURL) {
  const payload = await requestJSON(`${DASHSCOPE_BASE_URL}/services/audio/asr/transcription`, {
    headers: {
      'X-DashScope-Async': 'enable'
    },
    body: {
      model: ASR_MODEL,
      input: {
        file_urls: [fileURL]
      },
      parameters: {
        language_hints: ['zh']
      }
    }
  })

  const taskId = payload.output && payload.output.task_id
  if (!taskId) {
    throw new Error('ASR 未返回 task_id')
  }
  return taskId
}

function extractTranscriptFromResultJSON(payload) {
  const transcripts = payload.transcripts || payload.Transcripts || []
  if (Array.isArray(transcripts) && transcripts.length > 0) {
    const text = transcripts.map((item) => {
      return item.text || item.transcript || item.sentence || ''
    }).join('，').trim()
    if (text) {
      return text
    }
  }

  if (payload.text || payload.transcript) {
    return String(payload.text || payload.transcript).trim()
  }

  const sentences = payload.sentences || payload.Sentences || []
  if (Array.isArray(sentences)) {
    return sentences.map((item) => item.text || item.sentence || '').join('').trim()
  }

  return ''
}

async function waitASRTask(taskId) {
  for (let index = 0; index < 18; index += 1) {
    await delay(index === 0 ? 700 : 1000)
    const payload = await requestJSON(`${DASHSCOPE_BASE_URL}/tasks/${taskId}`)
    const output = payload.output || {}
    const status = output.task_status || output.status

    if (status === 'SUCCEEDED') {
      const result = output.results && output.results[0]
      if (!result) {
        throw new Error('ASR 任务成功但没有返回结果')
      }
      if (result.subtask_status && result.subtask_status !== 'SUCCEEDED') {
        throw new Error(result.message || result.code || 'ASR 子任务失败')
      }
      const transcriptURL = result.transcription_url || result.transcriptionUrl
      if (transcriptURL) {
        const resultJSON = await getJSON(transcriptURL)
        const text = extractTranscriptFromResultJSON(resultJSON)
        if (text) {
          return text
        }
      }
      const text = result.text || result.transcript || ''
      if (text) {
        return String(text).trim()
      }
      throw new Error(result.message || result.code || 'ASR 没有识别到有效文字')
    }

    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(output.message || output.error_message || `ASR 任务失败：${status}`)
    }
  }

  throw new Error('ASR 等待超时')
}

async function transcribe(fileID, cloudPath) {
  const file = await getASRFileURL(fileID, cloudPath)
  const taskId = await submitASRTask(file.fileURL)
  const text = await waitASRTask(taskId)
  return {
    text,
    source: file.source,
    ossObjectKey: file.ossObjectKey
  }
}

async function callQwen(question, history) {
  const payload = await requestJSON(`${DASHSCOPE_BASE_URL}/services/aigc/text-generation/generation`, {
    body: {
      model: CHAT_MODEL,
      input: {
        messages: buildMessages(question, history)
      },
      parameters: {
        result_format: 'message',
        temperature: 0.7,
        max_tokens: 600
      }
    }
  })

  const text = extractTextFromQwen(payload)
  if (!text) {
    throw new Error('聊天模型没有返回有效回答')
  }
  return text
}

function extractTTSUrl(payload) {
  const output = payload.output || {}
  const audio = output.audio || output.Audio || {}
  return audio.url || audio.Url || output.url || output.audio_url || ''
}

async function callTTS(text, voice = TTS_VOICE) {
  const payload = await requestJSON(`${DASHSCOPE_BASE_URL}/services/audio/tts/SpeechSynthesizer`, {
    body: {
      model: TTS_MODEL,
      input: { text },
      parameters: {
        voice,
        format: 'mp3',
        sample_rate: 24000
      }
    }
  })

  return extractTTSUrl(payload)
}

async function callTTSWithFallbackVoice(text) {
  try {
    return await callTTS(text, TTS_VOICE)
  } catch (error) {
    const fallbackVoice = getFallbackTTSVoice(TTS_MODEL)
    if (fallbackVoice && fallbackVoice !== TTS_VOICE) {
      console.warn(`tts failed with voice ${TTS_VOICE}, retry with ${fallbackVoice}`, error)
      return await callTTS(text, fallbackVoice)
    }
    throw error
  }
}

function emptyTTSData() {
  return {
    audioUrl: '',
    audioFileID: '',
    audioCloudPath: '',
    ttsSource: '',
    ttsCacheHit: false
  }
}

async function readTTSCache(cacheKey, timing = createTiming()) {
  const cacheStart = nowMs()
  try {
    const result = await ttsAudioCache.where({ cacheKey }).limit(1).get()
    timing.ttsCacheMs += elapsedSince(cacheStart)
    return result.data[0] || null
  } catch (error) {
    timing.ttsCacheMs += elapsedSince(cacheStart)
    console.warn('read tts cache failed', error)
    return null
  }
}

async function writeTTSCache(cacheRecord) {
  try {
    const existing = await ttsAudioCache.where({ cacheKey: cacheRecord.cacheKey }).limit(1).get()
    const data = {
      ...cacheRecord,
      updatedAt: db.serverDate()
    }
    if (existing.data.length > 0) {
      await ttsAudioCache.doc(existing.data[0]._id).update({ data })
      return
    }
    await ttsAudioCache.add({
      data: {
        ...data,
        createdAt: db.serverDate()
      }
    })
  } catch (error) {
    console.warn('write tts cache failed', error)
  }
}

async function synthesizeAnswerAudio(answerText, timing = createTiming()) {
  const speechText = buildSpeechText(answerText)
  let ttsData = emptyTTSData()
  let ttsError = ''

  if (!speechText) {
    return {
      ...ttsData,
      speechText,
      ttsModel: '',
      ttsError: '没有可播报的文本'
    }
  }

  const cacheKey = createTTSCacheKey(speechText)
  const cached = await readTTSCache(cacheKey, timing)
  if (cached && cached.fileID) {
    try {
      const tempUrlStart = nowMs()
      const audioUrl = await getTempFileURL(cached.fileID)
      timing.tempUrlMs += elapsedSince(tempUrlStart)
      return {
        audioUrl,
        audioFileID: cached.fileID,
        audioCloudPath: cached.cloudPath || '',
        ttsSource: 'wechat-cloud-cache',
        ttsCacheHit: true,
        speechText,
        ttsModel: cached.ttsModel || TTS_MODEL,
        ttsError: ''
      }
    } catch (error) {
      ttsError = error.message || '缓存音频临时链接生成失败'
      console.warn('tts cache temp url failed', error)
    }
  }

  try {
    const ttsStart = nowMs()
    let dashScopeAudioUrl = ''
    try {
      dashScopeAudioUrl = await callTTSWithFallbackVoice(speechText)
    } finally {
      timing.ttsMs += elapsedSince(ttsStart)
    }
    if (!dashScopeAudioUrl) {
      throw new Error('DashScope TTS 没有返回音频 URL')
    }
    ttsData = await uploadAudioToCloudStorage(dashScopeAudioUrl, timing)
    await writeTTSCache({
      cacheKey,
      speechText,
      ttsModel: TTS_MODEL,
      ttsVoice: TTS_VOICE,
      fileID: ttsData.audioFileID,
      cloudPath: ttsData.audioCloudPath,
      textLength: speechText.length
    })
  } catch (error) {
    ttsError = error.message || 'TTS 音频生成或中转失败'
    console.warn('tts failed', error)
  }

  return {
    ...ttsData,
    speechText,
    ttsModel: ttsData.audioUrl ? TTS_MODEL : '',
    ttsError,
    ttsCacheHit: false
  }
}

async function answerQuestion(question, history, timing = createTiming()) {
  if (!hasDashScopeConfig()) {
    const answerText = fallbackAnswer(question)
    return {
      answerText,
      speechText: buildSpeechText(answerText),
      audioUrl: '',
      engine: 'fallback-no-dashscope-key',
      ttsCacheHit: false,
      timing
    }
  }

  try {
    const qwenStart = nowMs()
    const answerText = await callQwen(question, history)
    timing.qwenMs += elapsedSince(qwenStart)
    const ttsResult = await synthesizeAnswerAudio(answerText, timing)
    return {
      answerText,
      engine: CHAT_MODEL,
      ...ttsResult,
      timing
    }
  } catch (error) {
    const answerText = fallbackAnswer(question)
    const ttsResult = await synthesizeAnswerAudio(answerText, timing)
    return {
      answerText,
      engine: 'fallback-qwen-failed',
      errMsg: error.message || '聊天模型调用失败',
      ...ttsResult,
      timing
    }
  }
}

async function chat(event) {
  const totalStart = nowMs()
  const timing = createTiming()
  const data = event.data || {}
  const history = data.history || []
  let transcript = String(data.text || '').trim()
  let asrModel = ''
  let asrError = ''
  let asrSource = ''
  let voiceOssObjectKey = ''

  if (!transcript && data.fileID) {
    if (!hasDashScopeConfig()) {
      return {
        success: true,
        data: {
          transcript: '',
          answerText: '语音服务还没有配置好，先用文字问我也可以。',
          audioUrl: '',
          engine: 'fallback-no-dashscope-key',
          asrModel: ''
        }
      }
    }

    try {
      const asrResult = await transcribe(data.fileID, data.cloudPath)
      transcript = asrResult.text
      asrModel = ASR_MODEL
      asrSource = asrResult.source
      voiceOssObjectKey = asrResult.ossObjectKey
    } catch (error) {
      asrError = error.message || '语音识别失败'
      transcript = ''
    }
  }

  if (!transcript) {
    return {
      success: false,
      errMsg: asrError || '没有识别到有效问题'
    }
  }

  const answer = await answerQuestion(transcript, history, timing)
  timing.totalMs = elapsedSince(totalStart)
  return {
    success: true,
    data: {
      transcript,
      asrModel,
      asrSource,
      voiceOssObjectKey,
      ...answer,
      asrError
    }
  }
}

const DEFAULT_TTS_WARMUP_ITEMS = [
  {
    question: '膝关节疼痛怎么办？',
    answerText: '爷爷奶奶，膝盖疼先别硬撑，今天把训练停一停，少走楼梯。要是明显肿胀、疼痛越来越重，或者走路受影响，请及时去医院看看。'
  },
  {
    question: '膝盖不好该怎么锻炼？',
    answerText: '爷爷奶奶，膝盖不好先从温和动作开始，比如踝泵、坐姿抬腿和短时间散步。练的时候不追求多，动作慢一点，疼痛加重就停下。'
  },
  {
    question: '日常怎么保护膝关节？',
    answerText: '爷爷奶奶，平时要少爬很多楼、少久蹲久跪，走路量慢慢加。先控制体重、注意保暖，再配合低冲击训练，膝盖会更轻松。'
  }
]

async function warmupTTSCache(event) {
  if (!hasDashScopeConfig()) {
    return {
      success: false,
      errMsg: '缺少 DASHSCOPE_API_KEY，无法预热 TTS 缓存'
    }
  }

  const inputItems = event.data && Array.isArray(event.data.items) && event.data.items.length > 0
    ? event.data.items
    : DEFAULT_TTS_WARMUP_ITEMS
  const items = inputItems.slice(0, 20)
  const results = []
  let warmed = 0
  let skipped = 0
  let failed = 0

  for (const item of items) {
    const answerText = String(item.answerText || item.answer || item.question || '').trim()
    const speechText = buildSpeechText(answerText)
    const cacheKey = createTTSCacheKey(speechText)
    const timing = createTiming()

    if (!speechText) {
      failed += 1
      results.push({
        question: item.question || '',
        status: 'failed',
        errMsg: '缺少可播报文本'
      })
      continue
    }

    const cached = await readTTSCache(cacheKey, timing)
    if (cached && cached.fileID) {
      skipped += 1
      results.push({
        question: item.question || '',
        speechText,
        status: 'cached',
        fileID: cached.fileID,
        timing
      })
      continue
    }

    const ttsResult = await synthesizeAnswerAudio(answerText, timing)
    if (ttsResult.audioFileID) {
      warmed += 1
      results.push({
        question: item.question || '',
        speechText: ttsResult.speechText,
        status: 'warmed',
        fileID: ttsResult.audioFileID,
        timing
      })
    } else {
      failed += 1
      results.push({
        question: item.question || '',
        speechText,
        status: 'failed',
        errMsg: ttsResult.ttsError || 'TTS 预热失败',
        timing
      })
    }
  }

  return {
    success: true,
    data: {
      warmed,
      skipped,
      failed,
      items: results
    }
  }
}

exports.main = async (event) => {
  try {
    switch (event.action) {
      case 'chat':
        return await chat(event)
      case 'warmupTTSCache':
        return await warmupTTSCache(event)
      default:
        return {
          success: false,
          errMsg: `Unknown action: ${event.action}`
        }
    }
  } catch (error) {
    return {
      success: false,
      errMsg: error.message || 'voiceService failed'
    }
  }
}
