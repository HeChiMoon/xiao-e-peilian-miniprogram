const DEFAULT_RULE = {
  name: '基础稳定识别',
  hint: '保持全身在绿色框内，动作放慢一点、稳一点。',
  minBrightness: 34,
  maxBrightness: 238,
  minContrast: 13,
  maxMotion: 0.2,
  minQualityScore: 72,
  stableFrames: 3,
  countCooldownMs: 2400,
  messages: {
    ready: '已经看到您了，请保持慢一点、稳一点。',
    qualified: '姿态和画面稳定，保持这个节奏。',
    counted: '识别到一次稳定有效动作，继续保持。',
    unstable: '动作放慢一点，保持身体稳定，小鹅才能看清楚。',
    noBody: '请后退一步，把头、肩、膝盖尽量放进绿色框内。',
    lowLight: '请打开房间灯光，身体尽量站在明亮位置。',
    tooBright: '请避开强光或窗户直射，保持全身清楚可见。'
  }
}

const RULES = {
  1: {
    name: '靠墙静蹲识别',
    hint: '背部贴墙，膝盖不要超过脚尖，保持慢和稳。',
    maxMotion: 0.13,
    minQualityScore: 70,
    stableFrames: 4,
    countCooldownMs: 3000,
    messages: {
      ready: '身体已经进入识别框，请背部贴墙，慢慢下蹲。',
      qualified: '静蹲姿势稳定，膝盖和身体保持住。',
      counted: '这一次静蹲很稳，继续保持背部贴墙。',
      unstable: '静蹲时不要晃，先稳住身体再继续。',
      noBody: '请让上半身和膝盖都进入绿色框，靠墙站稳。'
    }
  },
  2: {
    name: '直腿抬高识别',
    hint: '腿伸直再慢慢抬起，抬起和放下都不要借惯性。',
    maxMotion: 0.22,
    minQualityScore: 70,
    stableFrames: 3,
    countCooldownMs: 2200,
    messages: {
      ready: '请坐稳或躺稳，伸直腿后慢慢抬起。',
      qualified: '抬腿节奏稳定，继续慢慢完成。',
      counted: '识别到一次平稳抬腿，放下时也要慢。',
      unstable: '抬腿不要甩动，放慢一点更安全。',
      noBody: '请把大腿、小腿和脚尖尽量放进绿色框。'
    }
  },
  3: {
    name: '腘绳肌牵拉识别',
    hint: '坐稳后轻轻前倾，有拉伸感即可，不追求疼痛。',
    maxMotion: 0.15,
    minQualityScore: 71,
    stableFrames: 4,
    countCooldownMs: 2800,
    messages: {
      ready: '请坐稳，身体轻轻向前，不要突然用力。',
      qualified: '牵拉姿势稳定，保持轻柔呼吸。',
      counted: '这一次牵拉很平稳，幅度不用太大。',
      unstable: '前倾动作慢一点，避免突然压腿。',
      noBody: '请把坐姿、腿部和上半身放进绿色框。'
    }
  },
  4: {
    name: '臀桥识别',
    hint: '先收紧臀部，再慢慢抬起髋部，肩到膝保持稳定。',
    maxMotion: 0.2,
    minQualityScore: 72,
    stableFrames: 3,
    countCooldownMs: 2300,
    messages: {
      ready: '请躺稳，收紧臀部后再慢慢抬起。',
      qualified: '髋部抬起很稳，保持肩膝方向一致。',
      counted: '识别到一次稳定臀桥，落下时也要慢。',
      unstable: '抬起和落下都慢一点，不要用腰猛发力。',
      noBody: '请让肩部、髋部和膝盖尽量进入绿色框。'
    }
  },
  5: {
    name: '单腿站立识别',
    hint: '扶稳椅背，脚轻轻离地即可，身体晃动大就先放下。',
    maxMotion: 0.11,
    minQualityScore: 68,
    stableFrames: 5,
    countCooldownMs: 3200,
    messages: {
      ready: '请扶稳椅背，脚轻轻离地，先保持安全。',
      qualified: '站立很稳，继续扶好旁边支撑物。',
      counted: '这一次单腿站立很稳，累了就放下休息。',
      unstable: '身体晃动有点大，请先扶稳或放下脚。',
      noBody: '请让全身和支撑物一起进入绿色框。'
    }
  },
  6: {
    name: '踝泵识别',
    hint: '脚尖向上勾，再向下轻踩，节奏轻松均匀。',
    maxMotion: 0.24,
    minQualityScore: 69,
    stableFrames: 3,
    countCooldownMs: 1900,
    messages: {
      ready: '请坐稳，脚尖慢慢向上勾起。',
      qualified: '脚踝活动节奏不错，继续轻松完成。',
      counted: '识别到一次稳定踝泵，保持均匀节奏。',
      unstable: '脚踝动作不用快，轻轻勾脚再放下。',
      noBody: '请把小腿和脚部尽量放进绿色框。'
    }
  }
}

function mergeRule(rule) {
  return {
    ...DEFAULT_RULE,
    ...rule,
    messages: {
      ...DEFAULT_RULE.messages,
      ...(rule && rule.messages ? rule.messages : {})
    }
  }
}

function getVisionRule(levelId) {
  return mergeRule(RULES[Number(levelId)] || {})
}

module.exports = {
  getVisionRule
}
