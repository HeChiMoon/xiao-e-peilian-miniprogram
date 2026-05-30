# 小鹅陪练

微信小程序老人膝关节训练演示项目。

当前版本的目标不是完整商业化产品，而是一个可以稳定演示核心闭环的 demo：老人端主流程可跑通，云端数据真实落库，子女端已完成真实绑定并可查看老人概览。

## 当前重点

- 老人端主流程可演示
- 微信云开发后端已接通
- 姿势识别已接入阿里云 `BodyPosture`
- AI 语音问答已接入 ASR + Qwen + TTS
- 子女端已完成真实绑定链路和绑定后概览展示

## 当前主流程

### 老人端

身份选择 -> 注册建档 -> 首页 -> 测评 -> 每日练 -> 相机检测 -> 我的 -> 健康档案 / 训练记录 / 小百科

### 子女端

身份选择 -> 子女端 -> 扫码或输入绑定码 -> 确认绑定 -> 查看老人概览、最近测评、最近检测、今日训练概览

## 当前动作范围

姿势识别当前只保留 3 个核心动作：

1. 靠墙静蹲
2. 直腿抬高
3. 单腿站立

说明：

- 直腿抬高当前以坐姿版本为主
- 仰卧版本已暂停，不作为当前 demo 主支持方案

## 工程结构

- 小程序主工程：`miniprogram/`
- 云函数目录：`cloudfunctions/`
- 项目状态文档：`PROJECT_STATUS.md`
- 数据库初始化说明：`CLOUD_DATABASE_SETUP.md`
- 阿里云姿势识别配置说明：`ALIYUN_BODY_POSTURE_SETUP.md`
- 角色隔离说明：`ROLE_LOGIN_DATA_ISOLATION.md`

## 云开发环境

- 云环境 ID：`cloud1-d5g3p79uad048cf6a`

当前主要云函数：

- `elderService`
- `trainingService`
- `assessmentService`
- `bindingService`
- `poseService`
- `voiceService`

说明：

- `quickstartFunctions` 仍保留在仓库中，但不属于当前业务主链路

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
2. 选择云环境 `cloud1-d5g3p79uad048cf6a`
3. 部署业务云函数，建议使用“上传并部署：云端安装依赖”
4. 按 `CLOUD_DATABASE_SETUP.md` 初始化数据库集合
5. 按 `ALIYUN_BODY_POSTURE_SETUP.md` 配置姿势识别相关环境变量
6. 补齐语音服务所需的 DashScope / OSS 相关环境变量

## 当前页面结构

`miniprogram/app.json` 当前注册页面如下：

- `pages/role/index`
- `pages/login/elder`
- `pages/caregiver/index`
- `pages/admin/index`
- `pages/home/index`
- `pages/training/index`
- `pages/training/learn`
- `pages/training/practice`
- `pages/training/complete`
- `pages/pose/camera`
- `pages/pose/history`
- `pages/pose/detail`
- `pages/assessment/index`
- `pages/assessment/report`
- `pages/video/index`
- `pages/chat/index`
- `pages/records/index`
- `pages/archive/index`
- `pages/profile/edit`
- `pages/profile/index`

补充说明：

- `pages/index`
- `pages/example`

这两个目录仍在仓库里，但不是当前主流程页面。

## 当前产品边界

- 当前版本仍是 demo，不接真实诊疗能力
- 不做真实医院级判断，只做训练陪练和健康科普
- 子女端当前重点是绑定与概览，不是完整家庭看护后台
- 管理员端当前仍是 mock

## 当前已知问题

- `poseService` 仍有待清理的调试日志和边界情况
- 仓库中部分旧文件仍可能有历史编码问题
- 3 个动作的识别阈值仍需继续微调

## 下一步建议

1. 继续清理 `poseService` 已知问题和日志残留
2. 继续清理项目内残余乱码文案
3. 把子女端概览继续推进到更完整的真实数据工作台
4. 继续打磨 demo 视觉与演示路径
