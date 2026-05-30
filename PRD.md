# 小鹅陪练 — 产品需求文档 (PRD)

> 更新时间：2026-05-31 | 版本：V1.1

---

## 1. 产品概述

### 1.1 产品定位

**小鹅陪练**是一款面向老年人的膝关节康复训练微信小程序。通过 AI 姿态识别技术，帮助老人居家完成科学的膝关节训练，同时支持子女远程看护。

### 1.2 核心价值

| 维度 | 说明 |
|------|------|
| **对老人** | 居家即可获得 AI 姿态纠错指导，降低训练受伤风险 |
| **对子女** | 远程查看老人训练进度、测评报告和膝关节检测结果 |
| **对机构** | 运营看板监控用户活跃度、训练完成率和风险分布 |

### 1.3 产品形态

- 平台：微信小程序（原生开发）
- AppID：`wxde26c0a5776ed40b`
- 基础库：`2.20.1`
- 后端：微信云开发（云函数 + 云数据库 + 云存储）
- 云环境：`cloud1-7gh2sy5r1102b28c`
- AI 引擎：阿里云 BodyPosture（人体姿态识别）+ 阿里云百炼 DashScope（ASR / TTS / 大模型对话）

---

## 2. 用户角色与流程

### 2.1 三角色体系

```
启动小程序 → authService.getSessionState() 读取登录态
              ├── 已有老人资料 → 首页
              ├── 新用户 → 身份选择 (pages/role/index)
              │     ├── 老人端 → 注册页 → 首页
              │     ├── 子女端 → 家庭看护工作台
              │     └── 管理员端 → 运营看板
              └── 已有子女绑定 → 子女工作台
```

| 角色 | 入口 | 真实化程度 | 核心职责 |
|------|------|-----------|---------|
| **老人端** | `pages/login/elder` → `pages/home/index` | ✅ 已接入云开发 | 注册资料、每日训练、膝关节检测、测评、查看档案 |
| **子女端** | `pages/caregiver/index` | ⚠️ 绑定码已接云端，工作台仍为 mock | 绑定老人、查看老人数据、一键提醒 |
| **管理员端** | `pages/admin/index` | ❌ 纯 mock | 运营看板、内容配置 |

### 2.2 老人端完整流程

```
身份选择 → 填写姓名/性别/出生年份 → 进入首页
  ├── 膝关节检测 → 选择动作 → 拍照 → AI 分析 → 角度/评分/建议
  ├── 每日练 → 关卡地图 → 学习视频 → 相机练习 → 云端姿态抽检 → 完成
  ├── 健康测评 → Q&A 问答 → 动作测评 → 风险问答 → 测评报告
  ├── 视频号 → 康复科普视频列表
  ├── 小鹅问答 → 文字输入 / 按住语音 → ASR → Qwen 大模型 → TTS 语音播报
  └── 我的 → 训练记录 / 健康档案 / 完善资料 / 绑定子女
```

### 2.3 子女端绑定流程

```
老人端"我的" → 生成绑定码 → 云端创建 pending 记录
  → 子女端输入绑定码 → 云端确认 → status: bound
  → 绑定关系建立（后续可读取老人真实数据）
```

---

## 3. 技术架构

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────┐
│                  微信小程序前端 (miniprogram/)         │
│  21 个页面 · 9 个 Service · 本地 Storage 缓存          │
├─────────────────────────────────────────────────────┤
│              微信云开发 (cloud1-7gh2sy5r1102b28c)     │
│  ┌───────────────┬─────────────────┬──────────────┐  │
│  │  云函数 (7个)  │  云数据库 (7个)  │  云存储       │  │
│  └───────┬───────┴─────────────────┴──────────────┘  │
├──────────┼───────────────────────────────────────────┤
│  阿里云   │  OSS（上海）→ BodyPosture API（上海）       │
│          │  DashScope（百炼）→ ASR / TTS / Qwen       │
│          │  18 COCO 关键点 → 膝关节角度计算             │
└──────────┴───────────────────────────────────────────┘
```

### 3.2 云函数清单

| 云函数 | 集合 | 动作 | 状态 |
|--------|------|------|------|
| `elderService` | `elders` | `createOrUpdate` / `get` | ✅ 已上线 |
| `trainingService` | `training_progress` | `get` / `completeLevel` | ✅ 已上线 |
| `assessmentService` | `assessment_reports` | `saveLatest` / `getLatest` | ✅ 已上线 |
| `bindingService` | `caregiver_bindings` | `createBindingCode` / `getLatest` / `confirmBinding` | ✅ 已上线 |
| `poseService` | `pose_detection_records` / `action_standards` | `analyzeImage` / `getLatest` / `listHistory` / `listStandards` / `initStandards` / `diagnoseNetwork` | ✅ 已上线 |
| `voiceService` | `tts_audio_cache` | `chat`（ASR→Qwen→TTS）/ `warmupTTSCache` | ✅ 已上线 |
| `authService` | `elders` / `caregiver_bindings` | `getSessionState`（自动识别用户角色） | ✅ 已上线 |

### 3.3 数据库集合

| 集合 | 用途 | 核心字段 |
|------|------|---------|
| `elders` | 老人档案 | `ownerOpenId`, `name`, `gender`, `birthYear`, `medicalHistory`, `painAreas`, `emergencyContact`, `height`, `weight` |
| `training_progress` | 训练进度 | `ownerOpenId`, `completedIds`, `currentUnlocked` |
| `assessment_reports` | 测评报告 | `ownerOpenId`, `score`, `level`, `summary`, `suggestion` |
| `caregiver_bindings` | 子女绑定 | `ownerOpenId`, `bindingCode`, `status`, `caregiverOpenId` |
| `pose_detection_records` | 膝关节检测记录 | `ownerOpenId`, `keypoints`, `angles`, `score`, `riskLevel`, `engine`, `source` |
| `action_standards` | 动作标准库 | `actionKey`, `targetJoint`, `minAngle`, `maxAngle`, `idealAngle` |
| `tts_audio_cache` | TTS 语音缓存 | `cacheKey`, `speechText`, `ttsModel`, `fileID`, `cloudPath` |

### 3.4 前端 Service 层

| Service | 职责 |
|---------|------|
| `services/elderService.js` | 老人资料云端读写 |
| `services/trainingService.js` | 训练进度云端读写 |
| `services/assessmentService.js` | 测评报告云端读写 |
| `services/bindingService.js` | 子女绑定码管理 |
| `services/poseService.js` | 姿态检测：上传图片 + 调用云函数分析 + 历史查询 |
| `services/visionService.js` | 练习页本地视觉门控（光线/轮廓/稳定性） |
| `services/trainingVisionRules.js` | 6 个训练关卡的独立视觉规则配置 |
| `services/voiceService.js` | 语音对话：`chatByText`（文字提问）/ `chatByVoice`（语音提问+上传） |
| `services/authService.js` | 登录态管理：`getSessionState`（自动判断老人/子女/绑定状态） |

---

## 4. 功能模块详情

### 4.1 膝关节检测（核心 AI 模块）

**数据流：**

```
老人拍照 → wx.cloud.uploadFile → poseService 下载图片
  → 上传阿里云 OSS（上海）
  → 生成 OSS 签名 URL
  → 调用阿里云 BodyPosture API（上海）
  → 解析 18 个 COCO 关键点
  → 提取左右髋/膝/踝坐标
  → 计算膝关节向量角度
  → 与动作标准对比评分
  → 写入 pose_detection_records
  → 前端展示角度/评分/风险/Canvas 骨架图
```

**技术要点：**
- API：`BodyPosture 2019-12-30`，仅上海地域
- 签名：HMAC-SHA1 V1 (RPC) + OSS V1 签名 URL
- DNS 回退：`ALIYUN_FACEBODY_IP` 环境变量 + SNI
- 回退策略：无配置 → `mock-fallback-no-aliyun-config`；API 失败 → `mock-fallback-aliyun-failed`
- 已验证端到端耗时：约 983ms

**页面：**
- `pages/pose/index`：3 个动作 Tab（靠墙静蹲/直腿抬高/单腿站立）→ 拍照 → 结果展示
- `pages/pose/history`：检测历史列表，支持下拉刷新，显示引擎标识

### 4.2 每日练（训练系统）

**关卡体系（6 关）：**

| 关卡 | 动作 | 映射云端标准 |
|------|------|------------|
| 1 静蹲类 | 靠墙静蹲 | `wallSquat` |
| 2 直腿抬高类 | 直腿抬高 | `legRaise` |
| 3 拉伸类 | 腘绳肌牵拉 | `legRaise` |
| 4 臀桥类 | 臀桥 | `legRaise` |
| 5 单腿站立类 | 单腿站立 | `singleLegStand` |
| 6 踝泵类 | 踝泵运动 | `legRaise` |

**训练流程：**
```
关卡地图 → 学习页（教学视频） → 练习页（相机 + AI 纠错） → 完成页
```

**练习页双识别系统：**
- **本地轻量视觉门控**：检测光线/轮廓/稳定性，提供环境质量提示（不再计数）
- **云端姿态抽检**：每隔约 5.5 秒拍照一次，调用 `poseService` 真实分析膝关节角度
  - 连续 2 次云端达标才计 1 次有效动作
  - 显示实时膝关节角度、评分和纠错文案

**页面：**
- `pages/training/index`：关卡地图
- `pages/training/learn`：教学视频播放
- `pages/training/practice`：相机练习 + 实时反馈
- `pages/training/complete`：完成庆祝

### 4.3 健康测评

**流程：** Q&A 知识问答 → 动作完成度自评 → 疼痛/风险筛查

**风险处理：** 选择持续疼痛/剧烈疼痛时弹出安全提示并返回首页

**页面：**
- `pages/assessment/index`：测评问答
- `pages/assessment/report`：测评报告（评分/风险结论/训练建议）

### 4.4 视频号

- 康复科普视频列表（当前为静态 mock）
- 支持播放、点赞、收藏、评论（本地状态模拟）

### 4.5 小鹅问答（AI 语音对话）

**交互模式：**
- **文字输入**：手动输入问题 → 发送 → AI 回复
- **语音输入**：按住绿色按钮说话 → 松开自动发送 → ASR 转写 → AI 回复 → TTS 自动朗读

**语音交互完整链路：**

```
用户按住录音（mp3/16k/单声道，最长 10s）
  → wx.getRecorderManager 录音 → 上传云存储 (voice-recordings/)
  → voiceService 云函数下载录音
  → (可选) 中转至阿里云 OSS
  → 调用 DashScope ASR (paraformer-v2) 异步转写
  → 轮询等待转写结果（最长 ~19s）
  → 将转写文本送入 Qwen (qwen3.6-flash) 大模型对话
  → Qwen 以"小鹅"角色回复膝关节科普（system prompt 注入）
  → 提取前 2-3 句作为播报文本（≤100 字）
  → 调用 DashScope TTS (cosyvoice-v3-flash, 音色 longanyang)
  → 下载 TTS MP3 → 上传微信云存储 → 写入 tts_audio_cache 缓存
  → 前端自动播放语音 + 展示完整文字回答
```

**技术要点：**
- ASR 模型：`paraformer-v2`，支持中文语言提示
- 对话模型：`qwen3.6-flash`，temperature=0.7，max_tokens=600
- TTS 模型：`cosyvoice-v3-flash`，默认音色 `longanyang`，fallback 音色切换
- TTS 缓存：按 `speechText + model + voice` 生成 SHA1 cacheKey，避免重复生成
- 回退策略：无 API Key → 关键词匹配 fallback；Qwen 失败 → fallback 答案 + 重试 TTS
- 录音安全：权限拒绝保险超时 1.2s，最短有效录音 700ms

**Qwen System Prompt（"小鹅"角色）：**
- 身份：膝关节健康小百科，社区中老年科普
- 领域：膝关节炎常识、居家训练动作、疼痛应对、饮食保养、日常防护
- 风格："爷爷奶奶"开头，唠家常，短句口语，不吓唬人
- 安全边界：不诊断、不开药、不承诺疗效；遇危险症状提醒就医

**常见问题快捷入口：** 预设 3 个高频问题（膝关节疼痛/锻炼/日常保护），支持点击直接提问

**页面：** `pages/chat/index`

### 4.6 我的页

- 头像、健康等级
- 训练记录（独立大字号页面）
- 健康档案（姓名/年龄/健康等级/最近测评/最近膝关节检测/免责声明）
- 完善资料（病史/疼痛部位/紧急联系人/身高/体重/备注）
- 绑定子女（生成绑定码二维码）
- 设置 → 回到身份选择

### 4.7 子女端

- **已真实接入**：输入绑定码确认绑定
- **仍为 mock**：工作台卡片、老人健康摘要、训练/测评概览、多老人列表

### 4.8 管理员端

- 运营看板：用户数、训练完成率、风险分布（纯 mock）
- 内容配置：训练动作/视频/问答（只读展示）

---

## 5. AI 能力现状

| AI 能力 | 状态 | 说明 |
|---------|------|------|
| **3D 人体姿态评估** | ✅ 已接入 | 阿里云 BodyPosture，18 COCO 关键点，端到端验证通过 |
| **相机帧视觉识别** | ✅ Phase 1 | 轻量门控（光线/轮廓/稳定性），6 关卡独立规则 |
| **训练页实时姿态纠错** | ✅ Phase 1 | 周期抽检模式（~5.5s/次），复用 BodyPosture 链路 |
| **AI 语音交互** | ✅ 已接入 | DashScope ASR (paraformer-v2) + TTS (cosyvoice-v3-flash) + Qwen (qwen3.6-flash)，支持按住语音→转写→对话→播报完整链路，含 TTS 缓存 |
| **个性化训练计划** | ❌ 未接入 | 训练关卡为静态 6 关 |
| **智能视频推送** | ❌ 未接入 | 视频列表为静态 mock |

---

## 6. 用户故事

### 老人端

| ID | 故事 | 验收标准 |
|----|------|---------|
| U1 | 作为老人，我能用简单的方式注册进入系统 | 选择性别、输入姓名、拖动滑条选出生年份，3 步内完成 |
| U2 | 作为老人，我能拍照检测膝关节状态 | 选动作 → 拍照 → 看到角度/评分/风险提示/骨架图 |
| U3 | 作为老人，我能跟着每日练关卡做康复训练 | 看教学视频 → 开启相机练习 → 看到实时纠错 → 达标计数 |
| U4 | 作为老人，我能完成健康测评 | 回答问卷 → 做动作自评 → 回答风险问题 → 看到报告 |
| U5 | 作为老人，我能查看训练记录和健康档案 | 独立大页面，大字展示已完成关卡和健康摘要 |
| U6 | 作为老人，我能生成绑定码让子女关注我 | 我的页 → 绑定子女 → 生成二维码和绑定码 |
| U7 | 作为老人，我能用语音和小鹅聊天问膝关节问题 | 按住按钮说话 → 松开自动发送 → 看到文字回答 + 自动语音朗读 |

### 子女端

| ID | 故事 | 验收标准 |
|----|------|---------|
| C1 | 作为子女，我能通过绑定码关联老人 | 输入老人生成的绑定码 → 确认绑定 |
| C2 | 作为子女，我能查看已绑定老人的健康数据 | 待实现（目前绑定后可看 mock 工作台） |

---

## 7. 数据隔离模型

- 老人数据归属由微信云开发 `OPENID` 决定，同一 `OPENID` 下只维护一位老人
- 子女关系由 `caregiver_bindings` 中的 `caregiverOpenId` 关联
- 管理员端无真实权限和数据
- 本地 Storage 作为云端读取失败时的兜底缓存

---

## 8. 已知问题

1. **零置信度关键点**：BodyPosture 偶返回 `Confident: 0` 且坐标 `(0,0)` 的关键点，影响膝关节角度计算
2. **超时 Promise 悬挂**：`poseService` 云函数中 3 处 `request.destroy()` 不保证触发 error 事件
3. **拍照效率**：单次检测约 1s，高频训练场景需要改为视频帧模式
4. **OSS 时钟偏差**：云函数与 OSS 服务器时钟不同步可能导致签名失效
5. **训练动作标准不全**：6 个训练关卡中 4 个共用 `legRaise` 标准，需各建独立标准
6. **TTS 缓存命中依赖 temp URL**：缓存通过 `wx.cloud.getTempFileURL` 获取播放链接，链接过期后需重新生成
7. **ASR 异步轮询延迟**：Paraformer 异步模式轮询最长 ~19s，高延迟场景下用户体验下降
8. **Qwen 偶发拒绝回答**：即使 system prompt 设定了安全边界，大模型仍可能以医疗风险为由拒绝回答普通膝关节问题

---

## 9. 下一阶段规划

### 9.1 短期（技术优化）

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P0 | 修复零置信度关键点过滤 | 跳过 `Confident === 0` 或坐标 (0,0) 的点 |
| P0 | 修复超时 Promise 悬挂 | 3 处 `request.on('timeout')` 改为直接 reject |
| P1 | 为 6 个关卡建立独立动作标准 | 替换当前共用 `legRaise` 的临时映射 |
| P1 | 训练页实时视频帧模式 | 利用 `onCameraFrame` 每秒取帧，替代 5.5s 拍照周期 |

### 9.2 中期（功能完善）

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P1 | 检测详情页 | 左右膝分别角度、标准范围对比、骨架图回放 |
| P1 | 子女端真实数据读取 | 从绑定关系反查老人真实训练/测评/检测数据 |
| P2 | 个性化训练计划 | 基于检测结果和用户档案生成定制方案 |
| P2 | 管理员端真实数据 | 接入云端聚合统计，替换 mock 看板 |
| P2 | 扫码绑定 | 扫码解析二维码替代手动输入绑定码 |

### 9.3 长期（体验升级）

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P2 | TTS 缓存预热优化 | 利用 `warmupTTSCache` 预生成高频问题音频，减少首次等待 |
| P2 | 多轮对话上下文增强 | 优化 Qwen history 传递策略，提升追问场景体验 |
| P3 | 科普视频智能推送 | 基于老人档案和训练进度推荐视频 |
| P3 | 训练语音实时纠错提示 | TTS 实时播报角度偏差和纠错建议（替代当前文字提示） |
| P3 | WebSocket 实时姿态 | 高帧率实时云端姿态分析 |

---

## 10. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 阿里云 API 未来接口变更 | 膝关节检测不可用 | 已实现 mock fallback 兜底，保留降级链路 |
| 云函数 DNS 无法解析阿里云域名 | 检测失败 | 已实现 `ALIYUN_FACEBODY_IP` DNS 回退 + SNI |
| 微信云开发费用增长 | 运营成本上升 | 当前只保存检测结果 JSON，图片长期清理 |
| 老人使用门槛高 | 用户流失 | 适老 UI（大字/大按钮/少步骤），详情页简洁 |
| 姿态识别精度不足 | 训练指导不准确 | 保留 mock 兜底 + 人工校准阈值 + 后续引入更优模型 |
| DashScope API 不可用 | 语音问答和 TTS 播报不可用 | 已实现关键词匹配 fallback + OSS 中转录音双重保障 |
| TTS 音频缓存 temp URL 过期 | 用户无法回放历史语音 | 过期后自动重新调用 `getTempFileURL` |
| Qwen 模型幻觉或拒答 | 回答不准确或拒绝回答 | system prompt 限定知识边界 + fallback 预设答案兜底 |

---

## 11. 附录

### 11.1 页面路由表（21 页）

| 路由 | 页面 | TabBar |
|------|------|--------|
| `pages/role/index` | 身份选择 | - |
| `pages/login/elder` | 老人注册 | - |
| `pages/caregiver/index` | 子女工作台 | - |
| `pages/admin/index` | 管理员看板 | - |
| `pages/home/index` | 首页 | ✅ |
| `pages/training/index` | 训练地图 | - |
| `pages/training/learn` | 动作学习 | - |
| `pages/training/practice` | 动作练习 | - |
| `pages/training/complete` | 训练完成 | - |
| `pages/pose/index` | 膝关节检测 | - |
| `pages/pose/history` | 检测历史 | - |
| `pages/assessment/index` | 健康测评 | - |
| `pages/assessment/report` | 测评报告 | - |
| `pages/video/index` | 视频号 | - |
| `pages/chat/index` | 小鹅问答 | - |
| `pages/records/index` | 训练记录 | - |
| `pages/archive/index` | 健康档案 | - |
| `pages/profile/index` | 我的 | ✅ |
| `pages/profile/edit` | 完善资料 | - |

### 11.2 云函数环境变量

#### poseService

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `ALIYUN_ACCESS_KEY_ID` | 阿里云 RAM 子账号 AccessKey | ✅ |
| `ALIYUN_ACCESS_KEY_SECRET` | 对应 Secret | ✅ |
| `ALIYUN_OSS_BUCKET` | OSS Bucket 名称（上海） | ✅ |
| `ALIYUN_OSS_ENDPOINT` | OSS 地域节点 | 可选 |
| `ALIYUN_FACEBODY_ENDPOINT` | BodyPosture API 域名 | 可选 |
| `ALIYUN_FACEBODY_IP` | DNS 回退 IP | 可选 |

#### voiceService

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `DASHSCOPE_API_KEY` | 阿里云百炼 API Key（ASR/TTS/Qwen 共用） | ✅ |
| `DASHSCOPE_BASE_URL` | DashScope API 基础 URL，默认 `https://dashscope.aliyuncs.com/api/v1` | 可选 |
| `DASHSCOPE_CHAT_MODEL` | 对话模型，默认 `qwen3.6-flash` | 可选 |
| `DASHSCOPE_ASR_MODEL` | 语音识别模型，默认 `paraformer-v2` | 可选 |
| `DASHSCOPE_TTS_MODEL` | 语音合成模型，默认 `cosyvoice-v3-flash` | 可选 |
| `DASHSCOPE_TTS_VOICE` | TTS 音色，默认 `longanyang` | 可选 |
| `ALIYUN_ACCESS_KEY_ID` | 阿里云 AccessKey（OSS 中转录音） | 可选 |
| `ALIYUN_ACCESS_KEY_SECRET` | 对应 Secret | 可选 |
| `ALIYUN_OSS_BUCKET` | OSS Bucket（语音存储） | 可选 |
| `ALIYUN_OSS_ENDPOINT` | OSS 地域节点 | 可选 |
| `ALIYUN_OSS_PREFIX` | OSS 语音前缀，默认 `xiao-e-voice` | 可选 |

### 11.3 设计规范

| 元素 | 值 |
|------|----|
| 背景色 | `#F7F5F0`（暖米白） |
| 主文字色 | `#3F3F3F`（深炭灰） |
| 主色调 | `#F4A882`（蜜桃橙） |
| 辅助色 | `#88C9A1`（薄荷绿） |
| TabBar 选中色 | `#F4A882` |
| 适老字号 | 大字号，高对比度 |
| 视觉兼容 | iPhone 12/14 + 常见安卓尺寸 |

### 11.4 工程文件边界

- 主工程：`miniprogram/`
- 云函数：`cloudfunctions/`
- uni-app 参考实现：`xiao-e-peilian-uniapp/`（保留，不参与当前开发）
- 旧模板残留：`pages/index`、`pages/example`（不在 `app.json` 中引用）
- 原型截图：`_extracted_prototype/`
