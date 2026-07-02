const activeTrainingLevels = [
  {
    id: 1,
    name: '靠墙静蹲',
    shortName: '静蹲',
    video: '/pages/training/assets/wall-squat.mp4',
    image: '/assets/images/action-wall-squat.jpg',
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
    image: '/assets/images/action-single-leg-stand.jpg',
    description: '扶住椅背，慢慢抬起一只脚，保持身体稳定。',
    guide: '保持 8 秒以上，身体晃动过大时降低难度。',
    feedback: '旁边一定扶稳，脚轻轻离地就好。'
  }
]

const assessmentSections = {
  intro: {
    title: '小鹅下肢功能筛查',
    greeting: '爷爷奶奶好，我们先做一次简单筛查，看看疼痛、活动度、力量和平衡情况，再给出今天更合适的训练顺序。',
    safety: '这不是医生诊断。测试时请扶稳椅子或墙面，最好有家人在旁边。疼痛明显、刚做过手术、医生要求避免运动时，请先不要自测。'
  },
  profileFields: [
    { key: 'age', label: '年龄', unit: '岁', placeholder: '例如 68' },
    { key: 'height', label: '身高', unit: 'cm', placeholder: '例如 165' },
    { key: 'weight', label: '体重', unit: 'kg', placeholder: '例如 62' }
  ],
  profileQuestions: [
    {
      key: 'gender',
      title: '您的性别',
      dimension: 'profile',
      options: [
        { label: '男', value: 'male', score: 0 },
        { label: '女', value: 'female', score: 0 }
      ]
    },
    {
      key: 'living',
      title: '主要居住方式',
      dimension: 'profile',
      options: [
        { label: '与家人同住', value: 'family', score: 0 },
        { label: '独居', value: 'alone', score: 0 },
        { label: '养老机构', value: 'facility', score: 0 },
        { label: '其他', value: 'other', score: 0 }
      ]
    }
  ],
  healthQuestions: [
    {
      key: 'walkingAid',
      title: '行走时是否需要辅助工具？',
      dimension: 'safety',
      options: [
        { label: '不需要', value: 'none', score: 0 },
        { label: '手杖', value: 'cane', score: 2 },
        { label: '助行器', value: 'walker', score: 4 },
        { label: '轮椅', value: 'wheelchair', score: 8, block: true, reason: '平时主要使用轮椅，暂不建议自行完成动作筛查。' }
      ]
    },
    {
      key: 'painFrequency',
      title: '近 3 个月膝关节疼痛、肿胀或僵硬的频率',
      dimension: 'pain',
      options: [
        { label: '无', value: 'none', score: 0 },
        { label: '偶尔，每周 1-2 次', value: 'sometimes', score: 1 },
        { label: '经常，每周 3-5 次', value: 'often', score: 3 },
        { label: '持续，几乎每天', value: 'daily', score: 5 }
      ]
    },
    {
      key: 'painArea',
      title: '主要疼痛部位',
      dimension: 'pain',
      options: [
        { label: '无疼痛', value: 'none', score: 0 },
        { label: '膝盖前方', value: 'front', score: 1 },
        { label: '膝盖内侧', value: 'inside', score: 1 },
        { label: '膝盖外侧', value: 'outside', score: 1 },
        { label: '膝盖后方', value: 'back', score: 1 }
      ]
    },
    {
      key: 'treatment',
      title: '目前就医或康复情况',
      dimension: 'pain',
      options: [
        { label: '从未看过', value: 'none', score: 0 },
        { label: '看过医生但未治疗', value: 'checked', score: 1 },
        { label: '正在康复治疗', value: 'rehab', score: 1, caution: true }
      ]
    },
    {
      key: 'recentSurgery',
      title: '近 1 个月是否有下肢手术，或医生要求避免运动？',
      dimension: 'safety',
      options: [
        { label: '没有', value: 'no', score: 0 },
        { label: '有', value: 'yes', score: 8, block: true, reason: '近期有手术或运动限制，应先听医生或康复师意见。' }
      ]
    }
  ],
  painScale: {
    key: 'painScore',
    title: '如果有疼痛，疼痛程度大概几分？',
    guide: '0 分是不疼，10 分是难以忍受。没有疼痛可以选 0 分。',
    min: 0,
    max: 10
  },
  mobilityQuestions: [
    {
      key: 'kneeExtension',
      title: '坐稳后，能否把一条腿慢慢向前伸直？',
      guide: '坐在椅子或床边，身体坐直，一条腿慢慢向前伸直。不要憋气，不要硬撑。',
      dimension: 'mobility',
      options: [
        { label: '能轻松伸直', value: 'easy', score: 0 },
        { label: '勉强能伸直', value: 'hard', score: 2 },
        { label: '不能伸直', value: 'unable', score: 4 }
      ]
    }
  ],
  mobilityReasons: [
    { key: 'pain', label: '疼痛' },
    { key: 'stiffness', label: '关节僵硬' },
    { key: 'balance', label: '坐不稳' },
    { key: 'weakness', label: '肌肉无力' },
    { key: 'other', label: '其他' }
  ],
  timerTests: {
    sitToStand: {
      title: '五次坐站',
      guide: '坐在稳固椅子上，双脚踩稳。点击开始后完成 5 次站起坐下，再点完成。',
      target: '12 秒以内较好',
      unableText: '无法完成 5 次'
    },
    singleLegStand: {
      title: '扶椅单腿站立',
      guide: '扶稳椅背，单脚轻轻离地。点击开始后尽量站到 20 秒，站不住就点停止。',
      target: '20 秒较好',
      unableText: '无法站立'
    }
  },
  riskQuestions: [
    {
      key: 'fall',
      title: '近 1 年内是否有跌倒经历？',
      dimension: 'fallRisk',
      options: [
        { label: '无', value: 'none', score: 0 },
        { label: '1 次', value: 'once', score: 2 },
        { label: '2 次及以上', value: 'twice', score: 5 }
      ]
    },
    {
      key: 'dailyImpact',
      title: '目前下肢功能对生活质量的影响程度',
      dimension: 'dailyImpact',
      options: [
        { label: '无影响', value: 'none', score: 0 },
        { label: '轻微影响', value: 'mild', score: 1 },
        { label: '中度影响', value: 'middle', score: 3 },
        { label: '严重影响', value: 'severe', score: 5 }
      ]
    },
    {
      key: 'rehabWilling',
      title: '是否愿意接受专业康复指导或训练？',
      dimension: 'preference',
      options: [
        { label: '是', value: 'yes', score: 0 },
        { label: '否', value: 'no', score: 0 },
        { label: '不确定', value: 'unknown', score: 0 }
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
  avatar: '/assets/images/xiao-e-icons/role-elder.png',
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
    image: '/assets/images/xiao-e-icons/role-elder.png'
  },
  {
    role: 'caregiver',
    title: '子女端',
    desc: '查看老人训练和健康情况',
    action: '进入家庭看护',
    image: '/assets/images/xiao-e-icons/role-caregiver.png'
  },
  {
    role: 'admin',
    title: '管理员端',
    desc: '内容、数据和提醒管理入口',
    action: '进入管理台',
    image: '/assets/images/xiao-e-icons/settings.png'
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
