# 微信云开发初始化说明

更新时间：2026-05-31  
云环境 ID：`cloud1-7gh2sy5r1102b28c`

## 1. 当前适用范围

这份文档对应的是**当前 Demo 实际使用中的云开发结构**，不是早期第一阶段草案。

当前已经真实接入云端的内容包括：

- 老人资料
- 今日训练进度
- 最近一次测评报告
- 子女绑定关系
- 姿势检测记录
- TTS 音频缓存

管理员端仍不接真实后台数据。

## 2. 当前云函数

### `authService`

路径：`cloudfunctions/authService`

动作：

- `getSessionState`：读取当前微信调用者的会话状态、老人资料状态、子女绑定状态

### `elderService`

路径：`cloudfunctions/elderService`

动作：

- `createOrUpdate`：创建或更新当前微信调用者对应的老人资料
- `get`：读取当前微信调用者对应的老人资料
- `deleteMine`：删除当前微信调用者对应的老人资料

### `trainingService`

路径：`cloudfunctions/trainingService`

动作：

- `get`：读取今日训练进度
- `getPlan`：读取规则化个性化训练计划
- `completeLevel`：完成一个训练动作
- `reset`：重置今日训练进度

### `assessmentService`

路径：`cloudfunctions/assessmentService`

动作：

- `saveLatest`：覆盖保存当前微信调用者最近一次测评报告
- `getLatest`：读取最近一次测评报告
- `clearLatest`：清空最近一次测评报告

### `bindingService`

路径：`cloudfunctions/bindingService`

动作：

- `createBindingCode`：生成老人端绑定码和普通二维码
- `getLatest`：读取当前老人最近一条待绑定记录
- `getOwnerBindingStatus`：读取老人端绑定状态
- `confirmBinding`：子女端确认绑定
- `getCaregiverBinding`：读取子女端当前已绑定老人概览
- `clearMine`：清理当前账号相关绑定关系

### `poseService`

路径：`cloudfunctions/poseService`

动作：

- `analyzeImage`：分析上传图片并保存姿势检测记录
- `getLatest`：读取最近一次姿势检测
- `listHistory`：读取姿势检测历史
- `getDetail`：读取单条姿势检测详情
- `clearMine`：清空当前账号姿势检测记录
- `listStandards`：读取动作标准
- `initStandards`：初始化动作标准
- `diagnoseNetwork`：阿里云网络诊断

### `voiceService`

路径：`cloudfunctions/voiceService`

动作：

- `chat`：语音/文字问答主流程
- `warmupTTSCache`：预热 TTS 音频缓存

## 3. 建议部署方式

1. 用微信开发者工具导入项目根目录 `D:\微信小程序`
2. 选择云环境 `cloud1-7gh2sy5r1102b28c`
3. 对每个业务云函数选择“上传并部署：云端安装依赖”
4. 部署完成后重新编译小程序

## 4. 当前数据库集合

### `elders`

用途：老人资料

核心字段：

- `ownerOpenId`
- `name`
- `gender`
- `birthYear`
- `age`
- `healthLevel`
- `avatar`
- `phone`
- `medicalHistory`
- `painAreas`
- `emergencyContact`
- `height`
- `weight`
- `note`
- `profileComplete`
- `missingFields`
- `createdAt`
- `updatedAt`

说明：

- 当前一位微信调用者只对应一份老人资料

### `training_progress`

用途：今日训练进度

核心字段：

- `ownerOpenId`
- `completedIds`
- `currentUnlocked`
- `progressDate`
- `createdAt`
- `updatedAt`

说明：

- 当前每日练只记录 3 个动作的完成情况
- 当前只记录“完成了哪些动作”和“当前解锁位置”

### `assessment_reports`

用途：最近一次测评报告

核心字段：

- `ownerOpenId`
- `score`
- `level`
- `levelText`
- `summary`
- `suggestion`
- `answers`
- `createdAt`
- `savedAt`
- `updatedAt`

说明：

- 当前只保留最近一次测评结果

### `caregiver_bindings`

用途：老人和子女的绑定关系

核心字段：

- `ownerOpenId`
- `elderId`
- `elderName`
- `bindingCode`
- `qrPayload`
- `qrFileID`
- `qrCloudPath`
- `qrVersion`
- `status`
- `caregiverOpenId`
- `createdAt`
- `updatedAt`

说明：

- 当前使用普通二维码 + 绑定码方案
- `status` 主要为 `pending` 或 `bound`

### `pose_detection_records`

用途：姿势检测记录

核心字段：

- `ownerOpenId`
- `elderId`
- `elderName`
- `actionKey`
- `actionName`
- `fileID`
- `cloudPath`
- `ossObjectKey`
- `mediaType`
- `source`
- `trainingLevelId`
- `keypoints`
- `angles`
- `standard`
- `score`
- `riskLevel`
- `riskText`
- `suggestion`
- `engine`
- `apiProvider`
- `apiRequestId`
- `apiError`
- `createdAt`
- `updatedAt`

### `action_standards`

用途：动作阈值与标准配置

当前主要对应：

- 靠墙静蹲
- 直腿抬高
- 单腿站立

### `tts_audio_cache`

用途：语音播报音频缓存

核心字段：

- `cacheKey`
- `speechText`
- `model`
- `voice`
- `fileID`
- `cloudPath`
- `textLength`
- `createdAt`
- `updatedAt`

## 5. 首次初始化建议

1. 创建以下集合：
   - `elders`
   - `training_progress`
   - `assessment_reports`
   - `caregiver_bindings`
   - `pose_detection_records`
   - `action_standards`
   - `tts_audio_cache`
2. 部署所有业务云函数
3. 打开小程序，进入首页后让 `poseService.initStandards` 自动或手动初始化动作标准
4. 按 `ALIYUN_BODY_POSTURE_SETUP.md` 配置姿势识别环境变量
5. 为 `voiceService` 配置 DashScope 与 OSS 相关环境变量

## 6. 当前验证流程

### 老人资料

1. 进入老人注册页
2. 填写姓名、性别、出生年份
3. 提交后检查 `elders` 是否新增或更新记录

### 测评

1. 完成一次健康测评
2. 检查 `assessment_reports` 是否保存最近一次报告

### 每日练

1. 进入每日练并完成一个动作
2. 检查 `training_progress` 是否更新

### 绑定

1. 在老人端生成绑定码
2. 检查 `caregiver_bindings` 是否新增 `pending` 记录
3. 在子女端扫码或输入绑定码
4. 检查该记录是否更新为 `bound`

### 姿势检测

1. 从相机检测页完成一次动作检测
2. 检查 `pose_detection_records` 是否写入一条记录

### 语音问答

1. 在小百科提一个问题
2. 检查 `voiceService` 返回是否包含文字回答
3. 如启用 TTS，检查 `tts_audio_cache` 是否生成或命中缓存

## 7. 当前注意事项

- 当前项目是 Demo，不需要为集合设计过度复杂的权限模型
- 页面层主要通过云函数读写，不建议直接从页面读写集合
- 当前子女端已经不是纯 mock，绑定后会读取真实概览数据
- 管理员端仍为 mock，不需要为其增加真实数据初始化步骤
