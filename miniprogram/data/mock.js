const activeTrainingLevels = [
  {
    id: 1,
    name: '靠墙静蹲',
    shortName: '静蹲',
    video: '/pages/training/assets/wall-squat.mp4',
    image: '/assets/images/xiao-e/ok.jpg',
    description: '背部轻轻贴墙，双脚与肩同宽，慢慢下蹲到舒适位置。',
    guide: '膝盖朝向脚尖，保持 10 秒。疼痛明显时立刻停止。',
    feedback: '背贴墙面，膝盖不要超过脚尖，动作慢一点。'
  },
  {
    id: 2,
    name: '直腿抬高',
    shortName: '抬腿',
    video: '',
    image: '/assets/images/action-leg-raise.jpg',
    description: '坐在椅子或床边后伸直一条腿，慢慢向前抬平，再平稳放下。',
    guide: '膝盖保持伸直，脚尖轻轻勾起，不要借助惯性。',
    feedback: '抬腿时不要憋气，保持匀速。'
  },
  {
    id: 3,
    name: '单腿站立',
    shortName: '单腿站',
    video: '/pages/training/assets/single-leg-stand.mp4',
    image: '/assets/images/xiao-e/report.png',
    description: '扶住椅背，慢慢抬起一只脚，保持身体稳定。',
    guide: '保持 8 秒以上，身体晃动过大时降低难度。',
    feedback: '旁边一定扶稳，脚轻轻离地就好。'
  }
]

const assessmentSections = {
  intro: {
    title: '小鹅腿脚测评',
    greeting: '爷爷奶奶好，欢迎来到小鹅腿脚测评。我们像做小检查一样，看看膝盖和腿脚灵不灵便。',
    safety: '旁边一定要有稳固的椅子或墙壁扶着，最好有家人在旁边看着。如果觉得疼或者站不稳，马上停下来，不要勉强。'
  },
  basicQuestions: [
    {
      key: 'walking',
      title: '平时走路怎么样？',
      options: [
        { label: '完全可以自己走', value: 'independent', score: 0 },
        { label: '需要拐杖或助行器', value: 'support', score: 2 },
        { label: '主要坐轮椅', value: 'wheelchair', score: 5 }
      ]
    },
    {
      key: 'pain',
      title: '最近膝盖疼不疼？',
      options: [
        { label: '没有明显疼痛', value: 'none', score: 0 },
        { label: '偶尔疼一下', value: 'mild', score: 1 },
        { label: '经常疼，每周多次', value: 'persistent', score: 5, stop: true },
        { label: '疼得厉害，影响走路', value: 'severe', score: 6, stop: true }
      ]
    }
  ],
  actionTests: [
    {
      key: 'legShape',
      title: '照镜子看腿型',
      guide: '请面对镜子自然站立，看看两条腿是否一样直，膝盖是否明显内扣或外翻。',
      options: [
        { label: '双腿较直，比较对称', value: 'good', score: 0 },
        { label: '有一点不对称', value: 'fair', score: 1 },
        { label: '腿型明显歪斜或不对称', value: 'poor', score: 2 }
      ]
    },
    {
      key: 'squat',
      title: '试着蹲一蹲',
      guide: '扶住椅子，慢慢蹲一点点，再慢慢站起来。觉得疼就立刻停止。',
      options: [
        { label: '动作顺畅，不疼', value: 'good', score: 0 },
        { label: '有点费力或有点疼', value: 'fair', score: 1 },
        { label: '蹲不下去或疼得明显', value: 'poor', score: 2 }
      ]
    },
    {
      key: 'legRaise',
      title: '坐着抬抬腿',
      guide: '坐稳后，慢慢把一条腿向前抬起来，再轻轻放下。',
      options: [
        { label: '能轻松抬起来', value: 'easy', score: 0 },
        { label: '抬不起来', value: 'fail', score: 2 },
        { label: '抬起后明显发抖', value: 'shake', score: 2 },
        { label: '抬腿时膝盖疼', value: 'pain', score: 3 }
      ]
    },
    {
      key: 'balance',
      title: '单脚站一站',
      guide: '扶住椅背，轻轻抬起一只脚。尽量保持 10 秒，站不稳就马上放下。',
      options: [
        { label: '超过 10 秒，比较稳', value: 'stable', score: 0 },
        { label: '能站几秒，但有点晃', value: 'fair', score: 1 },
        { label: '几乎站不住', value: 'poor', score: 2 }
      ]
    },
    {
      key: 'ligament',
      title: '轻轻活动小腿',
      guide: '坐稳后，轻轻活动小腿。如果不确定动作，请让家人协助或跳过。',
      options: [
        { label: '没有明显不适', value: 'good', score: 0 },
        { label: '轻微不稳或酸胀', value: 'fair', score: 1 },
        { label: '明显疼痛或不敢做', value: 'poor', score: 2 }
      ]
    },
    {
      key: 'stride',
      title: '前后迈一小步',
      guide: '扶住椅子，一只脚向前迈一小步，再回到原位。动作要慢。',
      options: [
        { label: '能稳定完成', value: 'good', score: 0 },
        { label: '有点晃或膝盖不稳', value: 'fair', score: 1 },
        { label: '疼痛明显或无法完成', value: 'poor', score: 2 }
      ]
    },
    {
      key: 'jump',
      title: '原地轻轻踮脚',
      guide: '如果平时运动少、膝盖不舒服或心里没把握，可以直接跳过。',
      options: [
        { label: '能轻松完成', value: 'good', score: 0 },
        { label: '能做但不太稳', value: 'fair', score: 1 },
        { label: '跳过或不适合做', value: 'skip', score: 1 },
        { label: '疼痛明显', value: 'pain', score: 3 }
      ]
    }
  ],
  riskQuestions: [
    {
      key: 'fall',
      title: '过去一年里，您摔倒过吗？',
      options: [
        { label: '没有', value: 'no', score: 0 },
        { label: '1 次', value: 'once', score: 1 },
        { label: '2 次以上', value: 'twice', score: 3 }
      ]
    },
    {
      key: 'dailyImpact',
      title: '现在的腿脚会影响日常生活吗？',
      options: [
        { label: '完全不影响', value: 'none', score: 0 },
        { label: '有一点影响', value: 'some', score: 1 },
        { label: '影响很大', value: 'large', score: 3 }
      ]
    }
  ]
}

const videoItems = [
  {
    id: 'v1',
    title: '膝关节日常保护小知识',
    desc: '了解低冲击运动前的准备和膝盖保护方法。',
    src: '/pages/video/assets/science-1.mp4',
    likes: 128,
    saves: 34,
    comments: ['动作讲得很清楚', '适合给爸妈看']
  },
  {
    id: 'v2',
    title: '适合长者的运动前热身',
    desc: '慢慢活动脚踝和膝盖，让训练更安心。',
    src: '/pages/video/assets/science-2.mp4',
    likes: 96,
    saves: 28,
    comments: ['热身很实用']
  },
  {
    id: 'v3',
    title: '训练后如何放松腿部',
    desc: '训练之后放松大腿和小腿，第二天更轻松。',
    src: '/pages/video/assets/science-3.mp4',
    likes: 74,
    saves: 19,
    comments: ['收藏了']
  },
  {
    id: 'v4',
    title: '上下楼前先护好膝盖',
    desc: '讲清日常起身、转身和上下楼时的膝关节保护重点。',
    src: '/pages/video/assets/science-4.mp4',
    likes: 88,
    saves: 26,
    comments: ['这条很适合家里老人']
  },
  {
    id: 'v5',
    title: '膝盖不舒服时怎么安排活动',
    desc: '疼痛、酸胀或活动受限时，先怎么做更稳妥。',
    src: '/pages/video/assets/science-5.mp4',
    likes: 92,
    saves: 31,
    comments: ['讲得很实在']
  }
]

const knowledgeItems = [
  {
    question: '什么是膝关节炎？',
    answer: '膝关节炎是一种常见的关节问题，常和关节软骨磨损、退化有关，可能出现疼痛、肿胀、僵硬或活动受限。小鹅只做科普提醒，不能替代医生诊断。'
  },
  {
    question: '膝关节炎有哪些症状？',
    answer: '常见表现包括活动后疼、上下楼不舒服、早晨僵硬、关节肿胀、活动时有摩擦感。若疼痛持续或明显加重，应及时就医。'
  },
  {
    question: '日常怎么保护膝关节？',
    answer: '建议保持合适体重，避免长时间蹲跪，选择散步、太极等低冲击运动，并做温和的腿部力量练习。'
  },
  {
    question: '膝盖不好该怎么锻炼？',
    answer: '适合从低强度开始，例如直腿抬高、踮脚、短时间散步。训练原则是慢、稳、无明显疼痛。'
  },
  {
    question: '膝关节疼痛怎么办？',
    answer: '先暂停运动并观察。轻微酸胀可休息并降低强度；如果持续疼痛、刺痛、肿胀或无法行走，请尽快咨询医生。'
  },
  {
    question: '饮食上有什么建议？',
    answer: '日常可注意优质蛋白、钙、维生素 D 和新鲜蔬果摄入，同时控制体重，减轻膝关节负担。'
  }
]

const profile = {
  name: '张望',
  age: 65,
  birthYear: 1961,
  gender: '男',
  healthLevel: '良好',
  avatar: '/assets/images/xiao-e/avatar.png',
  phone: '19857520189'
}

const settings = {
  reminderEnabled: true,
  reminderTime: '09:00',
  frequency: '每天',
  voiceSpeed: 0.8,
  sound: '温和提醒'
}

const roleItems = [
  {
    role: 'elder',
    title: '老人端',
    desc: '测评、每日练、语音问答',
    action: '完善信息进入',
    image: '/assets/images/xiao-e/avatar.png'
  },
  {
    role: 'caregiver',
    title: '子女端',
    desc: '查看老人训练和健康情况',
    action: '进入家庭看护',
    image: '/assets/images/xiao-e/profile.png'
  },
  {
    role: 'admin',
    title: '管理员端',
    desc: '内容、数据和提醒管理入口',
    action: '进入管理台',
    image: '/assets/images/xiao-e/archive.png'
  }
]

const loginVoiceTips = [
  {
    keyword: '怎么注册',
    answer: '请先填写姓名，再选择出生年份，最后点击完成注册就可以进入小鹅陪练。'
  },
  {
    keyword: '年龄怎么选',
    answer: '请拖动出生年份，选到您出生的年份。小鹅会自动帮您计算年龄。'
  },
  {
    keyword: '不会打字',
    answer: '您可以请家人帮忙输入姓名，也可以按住语音按钮提问，小鹅会一步步提示。'
  }
]

const caregiverDashboard = {
  familyName: '张望的家庭看护',
  elders: [
    {
      name: '张望',
      age: 65,
      risk: '低风险',
      training: '今日 2/3',
      lastReport: '良好 · 12分'
    },
    {
      name: '李桂兰',
      age: 72,
      risk: '中风险',
      training: '今日 1/3',
      lastReport: '需关注 · 24分'
    }
  ],
  reminders: ['上午 9:00 每日练提醒', '每周日查看训练报告']
}

const adminDashboard = {
  metrics: [
    { label: '当前用户', value: '128' },
    { label: '今日训练', value: '86' },
    { label: '内容视频', value: '12' },
    { label: '风险提醒', value: '9' }
  ],
  tasks: ['训练动作内容维护', '科普视频内容审核', '高风险测评提醒查看']
}

module.exports = {
  trainingLevels: activeTrainingLevels,
  assessmentSections,
  videoItems,
  knowledgeItems,
  profile,
  settings,
  roleItems,
  loginVoiceTips,
  caregiverDashboard,
  adminDashboard
}
