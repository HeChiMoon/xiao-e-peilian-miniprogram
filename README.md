# 小鹅陪练

面向中老年人的膝关节康复训练微信小程序 Demo。

当前版本的目标不是完整商业化产品，而是一个可以稳定演示核心闭环的 Demo：老人端主流程可跑通，核心业务数据真实落库，子女端已完成真实绑定并可查看老人概览，姿势识别与语音问答能力可演示。

## 当前项目定位

当前真正可讲的产品核心是：

- 老人端建档、测评、每日练、姿势检测、科普视频、小百科问答
- 子女端真实绑定与轻量概览
- 微信云开发落库
- 阿里云姿势识别 + DashScope 语音问答能力接入

当前最完整的是老人端。  
子女端已经不是纯 mock。  
管理员端仍是 mock 展示页。

## 当前主流程

### 老人端

身份选择 -> 注册建档 -> 首页 -> 测评 / 每日练 / 科普视频 / 小百科 -> 我的

说明：

- 注册页支持“先保存关键资料，再进入首页”
- 注册页已接入语音辅助问答
- 每日练当前通过独立相机检测页完成动作判断

### 子女端

身份选择 -> 子女端 -> 扫码或输入绑定码 -> 确认绑定 -> 查看老人概览、最近测评、最近检测、今日训练进度

## 当前动作范围

姿势识别当前只保留 3 个核心动作：

1. 靠墙静蹲
2. 直腿抬高
3. 单腿站立

说明：

- 直腿抬高当前只保留坐姿版本
- 仰卧版本已暂停，不作为当前 Demo 主支持方案
- 旧 6 动作方案已退出当前主流程

## 当前 AI 能力

### 姿势识别

- 技术路线：阿里云 `BodyPosture`
- 前端拍照 -> 微信云存储 -> `poseService` -> 阿里云 OSS + `BodyPosture`
- 当前支持角度、评分、建议、历史记录、详情页骨架示意

### 语音问答

- 已接入 ASR + Qwen + TTS
- 支持打字提问和语音提问
- 先显示文字回答
- 当前版本可自动朗读可播放语音
- 已实现 TTS 音频缓存与微信云存储中转

## 当前视频与训练资源状态

- 科普视频页已改为竖滑短视频形式
- 视频页和训练页都已拆分为分包
- 本地视频资源会先复制到用户目录再播放
- 科普视频和训练视频已做更保守的真机兼容处理
- 直腿抬高当前为图片示范

## 工程结构

- 小程序主工程：`miniprogram/`
- 云函数目录：`cloudfunctions/`
- PRD：`PRD.md`
- 项目状态文档：`PROJECT_STATUS.md`
- 数据库初始化说明：`CLOUD_DATABASE_SETUP.md`
- 阿里云姿势识别配置说明：`ALIYUN_BODY_POSTURE_SETUP.md`
- 角色隔离说明：`ROLE_LOGIN_DATA_ISOLATION.md`

## 云开发环境

- 云环境 ID：`cloud1-7gh2sy5r1102b28c`

当前主要云函数：

- `authService`
- `elderService`
- `trainingService`
- `assessmentService`
- `bindingService`
- `poseService`
- `voiceService`

## 当前数据集合

- `elders`
- `training_progress`
- `assessment_reports`
- `caregiver_bindings`
- `pose_detection_records`
- `action_standards`
- `tts_audio_cache`

## 运行方式

1. 用微信开发者工具导入根目录 `D:\微信小程序`
2. 选择云环境 `cloud1-7gh2sy5r1102b28c`
3. 部署业务云函数，建议使用“上传并部署：云端安装依赖”
4. 按 `CLOUD_DATABASE_SETUP.md` 初始化数据库集合
5. 按 `ALIYUN_BODY_POSTURE_SETUP.md` 配置姿势识别相关环境变量
6. 补齐语音服务所需的 DashScope / OSS 相关环境变量

## 当前页面结构

### 主包页面

- `pages/role/index`
- `pages/login/elder`
- `pages/caregiver/index`
- `pages/admin/index`
- `pages/home/index`
- `pages/pose/camera`
- `pages/pose/history`
- `pages/pose/detail`
- `pages/assessment/index`
- `pages/assessment/report`
- `pages/chat/index`
- `pages/records/index`
- `pages/archive/index`
- `pages/profile/edit`
- `pages/profile/index`

### 分包页面

`pages/training/*`

- `index`
- `learn`
- `practice`
- `complete`

`pages/video/*`

- `index`

## 当前产品边界

- 当前版本仍是 Demo，不接真实诊疗能力
- 不做真实医院级判断，只做训练陪练和健康科普
- 子女端当前重点是绑定与概览，不是完整家庭看护后台
- 管理员端当前仍是 mock
- 当前姿势识别适合演示，不应表述为医疗级动作识别

## 当前已知问题

- `poseService` 仍有待清理的调试日志和边界情况
- 仓库中部分旧文件仍可能有历史编码问题
- 3 个动作的识别阈值仍需继续微调
- 子女端仍偏轻量，不是完整工作台
- 个别真机环境下视频播放仍需要继续验证稳定性

## 建议先读的文档

- `PRD.md`：当前产品边界、主流程、未来规划
- `PROJECT_STATUS.md`：当前开发进度、已完成能力、已知问题
- `CLOUD_DATABASE_SETUP.md`：数据库集合初始化
- `ALIYUN_BODY_POSTURE_SETUP.md`：姿势识别环境变量配置

## 下一步建议

1. 继续清理 `poseService` 已知问题和日志残留
2. 继续清理项目内残余乱码文案
3. 对真机视频播放再做最后一轮稳定性验证
4. 清理旧测试数据和旧演示残留
5. 继续打磨 Demo 视觉与演示路径
