# 小鹅陪练图标与表情素材规范

本文档用于后续补齐小鹅图标素材，保证老人端、子女端和演示页面的视觉风格一致。

## 目录约定

- `miniprogram/assets/images/xiao-e-icons/`：小程序实际引用的压缩图标和状态表情。
- `design-assets/newpic-ready/`：已整理、已压缩、与小程序图标同名的交付版素材。
- `design-assets/newpic-source/`：设计师交付的 18 张原始图标源图。
- `design-assets/icons-ready/`：旧版已整理图标备份，仅作历史参考。
- `design-assets/expressions-ready/`：旧版已整理表情备份，仅作历史参考。
- `design-assets/icons-needed/`：待补图标清单和后续新增源文件。
- `design-assets/source-originals/`：原始大图备份，不直接进入小程序包。

## 当前已接入图标

1. `role-elder.png`：老人端身份选择，不要直接复用头像，建议表现“老人使用小鹅陪练”。
2. `role-caregiver.png`：子女端身份选择，建议表现“家人看护/手机绑定”。
3. `register-name.png`：注册姓名输入，建议表现“填写资料/名片”。
4. `voice-assistant.png`：注册页语音助手，建议表现“麦克风 + 小鹅”，不要只写文字。
5. `gender-male.png`：男性选项。
6. `gender-female.png`：女性选项。
7. `birth-year.png`：出生年份选择，建议表现“日历/年份”。
8. `profile-edit.png`：完善资料。
9. `caregiver-bind.png`：绑定子女，建议表现“二维码/连接”。
10. `training-record.png`：训练记录。
11. `health-archive.png`：健康档案。
12. `pose-history.png`：检测历史。
13. `settings.png`：设置。
14. `scan-bind.png`：子女端扫一扫/绑定老人。

当前还额外保留 4 个状态表情：

1. `thinking.png`：思考中。
2. `listening.png`：正在听。
3. `warning.png`：温和提醒。
4. `done.png`：完成确认。

## 设计规则

1. 形象统一：图标都围绕小鹅角色展开，可以加入道具，但小鹅轮廓、眼睛、嘴巴、腮红风格保持一致。
2. 构图统一：主体居中，安全边距不少于画布宽高的 12%，不要贴边。
3. 画布统一：源文件建议 1024 x 1024 或 1280 x 1280，透明背景 PNG。
4. 小程序压缩版：实际入包图片建议长边 220 到 260 px，单张控制在 120 KB 以内。
5. 色彩统一：主色以暖白、橙粉、浅绿为主，辅助色可用浅蓝，但不要出现大面积深色、紫色或高饱和霓虹色。
6. 线条统一：圆角、柔和、低对比阴影，避免尖锐科技风。
7. 语义明确：每个图标只表达一个动作或功能，不要把“资料”“报告”“视频”“训练”混在同一张图里。
8. 适老可读：小图标在 96 rpx 到 152 rpx 显示时也要能看懂，大形状优先，减少小字。
9. 不放文字：图标内部尽量不要写汉字，页面文字由 WXML 承担，避免缩放后糊掉。
10. 不复用错位：头像只做头像；报告图只做测评/报告；资料图只做资料；子女端和绑定需要单独图标。

## 命名规则

- 使用小写英文和连字符。
- 功能图标用名词或动词短语，例如 `voice-assistant.png`、`caregiver-bind.png`。
- 表情图标用情绪词，例如 `happy.png`、`celebrate.png`。
- 原始大图可以放在 `design-assets/source-originals/` 或 `design-assets/newpic-source/`，小程序只引用 `miniprogram/assets/images/xiao-e-icons/` 中的压缩版。

## 当前补充说明

旧版 `miniprogram/assets/images/xiao-e/` 目录已从运行路径中退出。后续新增图标时，先放源图到 `design-assets/newpic-source/` 或 `design-assets/source-originals/`，再导出压缩版到 `miniprogram/assets/images/xiao-e-icons/`。
