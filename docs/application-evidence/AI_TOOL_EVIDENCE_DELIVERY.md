# AI 工具使用证明交付清单

本文件对应申报表第 13 项“AI 工具使用证明”和第 14 项“AI 工具附件使用指引”。

当前项目使用 AI 的证据应分成三类提交：AI 协作过程证明、产品效果截图、源码实现证据。第 13 项上传附件，第 14 项填写这些附件如何查看。

## 13 AI 工具使用证明

建议上传 6 个附件，按下面顺序命名。

### 01-AI工具调用证明.png

用途：证明项目开发过程中实际使用了 AI 工具。

建议截图内容：

- Codex 对话中关于需求拆解、代码修改、问题排查、UI 打磨或文档整理的记录。
- 如果要展示 Skill 配置，可截取 `C:\Users\HP\.codex\skills\xiao-e-project-context\SKILL.md`、`C:\Users\HP\.codex\skills\xiao-e-demo-polish\SKILL.md` 等文件内容。
- 也可以截取本项目内归档的 AI 技能文档，例如 `D:\微信小程序\docs\AI_SKILLS.md` 或 `D:\微信小程序\docs\ai-skills\` 目录。

注意：

- 这张图重点是证明“AI 工具参与开发过程”，不是展示小程序页面。
- 不要截 AccessKey、API Key、Secret、openid、手机号等隐私或密钥。

### 02-小百科语音问答截图.png

用途：证明 AI 语音问答能力在小程序中有实际呈现。

建议截图页面：

- 小程序页面：`pages/chat/index`
- 前端源码：`D:\微信小程序\miniprogram\pages\chat\index.js`
- 服务封装：`D:\微信小程序\miniprogram\services\voiceService.js`
- 云函数：`D:\微信小程序\cloudfunctions\voiceService\index.js`

截图最好展示：

- 语音输入按钮。
- AI 文字回答。
- 语音播报入口或自动朗读状态。

已有候选截图：

- `D:\微信小程序\docs\application-evidence\screenshots\weapp-polish-chat.png`

如果 UI 已变化，优先用真机或开发者工具重新截图。

### 03-姿势检测结果截图.png

用途：证明姿势识别不是纯文案，而是有相机检测、识别反馈和记录链路。

建议截图页面：

- 相机检测页：`pages/pose/camera`
- 检测历史页：`pages/pose/history`
- 检测详情页：`pages/pose/detail`

相关源码：

- `D:\微信小程序\miniprogram\pages\pose\camera.js`
- `D:\微信小程序\miniprogram\pages\pose\history.js`
- `D:\微信小程序\miniprogram\pages\pose\detail.js`
- `D:\微信小程序\miniprogram\services\poseService.js`
- `D:\微信小程序\cloudfunctions\poseService\index.js`

截图最好展示：

- 当前动作名称。
- 检测结果或检测失败后的友好反馈。
- 角度、评分、风险提示或历史记录。

### 04-子女端绑定概览截图.png

用途：证明子女端不是纯 mock，已完成真实绑定和概览读取。

建议截图页面：

- 子女端页面：`pages/caregiver/index`

相关源码：

- `D:\微信小程序\miniprogram\pages\caregiver\index.js`
- `D:\微信小程序\miniprogram\services\bindingService.js`
- `D:\微信小程序\cloudfunctions\bindingService\index.js`

截图最好展示：

- 扫一扫或输入绑定码入口。
- 绑定成功提示。
- 绑定后的老人概览、最近测评、最近检测或今日训练进度。

### 05-voiceService代码证据.png

用途：证明 AI 语音问答链路真实接入。

建议截图文件：

- `D:\微信小程序\cloudfunctions\voiceService\index.js`

建议截图位置：

- 第 15 行附近：`tts_audio_cache` 集合。
- 第 35 到 37 行附近：Qwen、ASR、TTS 模型配置。
- 第 308 行附近：TTS 音频下载后上传微信云存储。
- 第 495 行附近：问答 Prompt 构造。
- 第 648 行附近：ASR 转写入口。
- 第 659 行附近：Qwen 问答调用。
- 第 761 行附近：TTS 缓存、合成和返回前端音频。
- 第 944 行附近：TTS 缓存预热。

截图时不要展示环境变量具体值。

### 06-poseService代码证据.png

用途：证明姿势识别、角度计算和检测记录保存真实实现。

建议截图文件：

- `D:\微信小程序\cloudfunctions\poseService\index.js`

建议截图位置：

- 第 12 行附近：`pose_detection_records` 集合。
- 第 14 行附近：`action_standards` 集合。
- 第 112 行附近：三点夹角计算。
- 第 218 行附近：靠墙静蹲角度计算。
- 第 348 行附近：直腿抬高角度计算。
- 第 396 行附近：单腿站立角度计算。
- 第 692 行附近：阿里云 `BodyPosture` 调用参数。
- 第 1145 行附近：关键点检测入口。
- 第 1211 行附近：姿势分析主流程。
- 第 1235 行附近：检测记录保存字段。

截图时不要展示 AccessKey、Secret 或 OSS 签名链接。

## 14 AI 工具附件使用指引

申报表第 14 项可以直接填写下面这段：

```text
本次提交的附件按“AI 协作过程、产品效果、代码证据”三类组织。

第一类为 AI 工具调用证明，用于说明项目开发过程中如何借助 AI 完成需求拆解、代码修改、问题排查、UI 打磨和文档整理。评审可先查看“01-AI工具调用证明.png”，了解 AI 在项目开发中的参与方式。

第二类为产品效果截图，用于展示 AI 能力在小程序中的实际呈现，包括小百科语音问答、姿势检测结果、子女端绑定和老人概览等页面。评审可查看“02-小百科语音问答截图.png”“03-姿势检测结果截图.png”“04-子女端绑定概览截图.png”。

第三类为代码证据截图，用于验证 AI 能力的真实实现。其中 voiceService 对应 ASR 语音识别、Qwen 问答、TTS 语音合成、TTS 缓存和微信云存储音频中转；poseService 对应人体姿态识别、关键点处理、膝关节角度计算、动作评分和检测记录保存。评审可查看“05-voiceService代码证据.png”和“06-poseService代码证据.png”。

附件中已避免展示 AccessKey、API Key、Secret、openid、手机号等隐私或密钥信息。项目中的姿势识别能力仅用于训练陪练和健康科普，不作为医疗诊断依据。
```

## 当前还需要补拍的截图

优先补拍以下 4 张：

1. Codex 或其他 AI 工具对话截图，作为 `01-AI工具调用证明.png`。
2. 小百科完成一次语音或文字问答后的页面，作为 `02-小百科语音问答截图.png`。
3. 姿势检测成功或检测历史详情页，作为 `03-姿势检测结果截图.png`。
4. 子女端绑定成功后的概览页，作为 `04-子女端绑定概览截图.png`。

代码证据图可以直接从源码编辑器或开发者工具里截取，不需要真机。
