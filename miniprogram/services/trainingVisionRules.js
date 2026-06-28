const DEFAULT_RULE = {
  name: '基础稳定识别',
  hint: '动作慢一点、稳一点，身体尽量完整入镜。',
  minBrightness: 34,
  maxBrightness: 238,
  minContrast: 13,
  maxMotion: 0.2,
  minQualityScore: 72,
  stableFrames: 3,
  countCooldownMs: 2400,
  messages: {
    ready: '已经看到您了，请保持慢一点、稳一点。',
    qualified: '姿势和画面都比较稳定，继续保持。',
    counted: '这次动作已经记上了，继续保持这个节奏。',
    unstable: '动作放慢一点，身体先稳住，小鹅才能看得更清楚。',
    noBody: '请往后退一点，让身体尽量完整入镜。',
    lowLight: '现在有点暗，打开房间灯光会更容易识别。',
    tooBright: '光线有点太强了，避开窗边直射会更清楚。'
  }
}

const RULES = {
  1: {
    name: '靠墙静蹲识别',
    hint: '背部贴墙，膝盖朝向脚尖，慢慢下蹲到舒适位置。',
    maxMotion: 0.13,
    minQualityScore: 70,
    stableFrames: 4,
    countCooldownMs: 3000,
    messages: {
      ready: '已经进入识别范围了，请背部贴墙，慢慢下蹲。',
      qualified: '静蹲姿势比较稳，继续保持背部贴墙。',
      counted: '这次静蹲完成得不错，继续保持。',
      unstable: '静蹲时先别着急，稳住身体再继续。',
      noBody: '请让上半身和膝盖都进入画面里，系统才看得清。'
    }
  },
  2: {
    name: '直腿抬高识别',
    hint: '当前按坐姿版本识别，伸直一条腿后慢慢抬起，再稳稳放下。',
    maxMotion: 0.22,
    minQualityScore: 70,
    stableFrames: 3,
    countCooldownMs: 2200,
    messages: {
      ready: '请坐稳后伸直一条腿，再慢慢抬起来。',
      qualified: '抬腿节奏比较稳，继续慢起慢落。',
      counted: '这次直腿抬高已经记上了，放下时也慢一点。',
      unstable: '抬腿不要甩，慢一点更容易通过。',
      noBody: '请把腰、髋、膝盖、小腿和脚尖尽量拍进画面里。'
    }
  },
  3: {
    name: '单腿站立识别',
    hint: '扶稳椅背，轻轻抬起一只脚，身体晃动太大就先放下。',
    maxMotion: 0.11,
    minQualityScore: 68,
    stableFrames: 5,
    countCooldownMs: 3200,
    messages: {
      ready: '请先扶稳旁边的支撑物，再轻轻抬起一只脚。',
      qualified: '现在站得比较稳，继续扶稳慢慢保持。',
      counted: '这次单腿站立已经完成，累了就先放下休息。',
      unstable: '身体有点晃，先扶稳再继续。',
      noBody: '请让全身和支撑物一起进入画面里。'
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
