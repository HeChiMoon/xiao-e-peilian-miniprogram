# 微信云开发初始化说明

云环境 ID：`cloud1-d5g3p79uad048cf6a`

## 本轮范围
- 第一阶段只接老人端后端。
- 登录方式仍是三角色身份选择，不新增账号密码或微信授权页面。
- 老人资料、训练进度、测评报告和绑定子女关系均已接云端。
- 子女端和管理员端本轮保持 mock。

## 云函数
### elderService
路径：`cloudfunctions/elderService`

动作：
- `createOrUpdate`：创建或更新当前微信云调用者对应的老人资料。
- `get`：读取当前微信云调用者对应的老人资料。

### trainingService
路径：`cloudfunctions/trainingService`

动作：
- `get`：读取当前微信云调用者对应的训练进度。
- `completeLevel`：完成一个训练关卡，合并 `completedIds` 并更新 `currentUnlocked`。

### assessmentService
路径：`cloudfunctions/assessmentService`

动作：
- `saveLatest`：覆盖保存当前微信云调用者最近一次测评报告。
- `getLatest`：读取当前微信云调用者最近一次测评报告。

### bindingService
路径：`cloudfunctions/bindingService`

动作：
- `createBindingCode`：生成老人端绑定码和二维码内容，并写入待绑定记录。
- `getLatest`：读取当前微信云调用者最近一条待绑定记录。
- `confirmBinding`：子女端输入绑定码后确认绑定，将记录状态更新为 `bound`。

部署方式：
1. 用微信开发者工具导入项目根目录 `D:\微信小程序`。
2. 右键 `cloudfunctions/elderService`、`cloudfunctions/trainingService`、`cloudfunctions/assessmentService` 和 `cloudfunctions/bindingService`。
3. 选择“上传并部署：云端安装依赖”。
4. 部署完成后重新编译小程序。

## 数据库集合
### elders
用途：老人资料，一位当前云调用者只保留一份资料。

字段：
- `_id`：云数据库自动生成。
- `ownerOpenId`：云函数中获取的 OpenID，用于定位当前老人资料。
- `name`：姓名。
- `gender`：性别。
- `birthYear`：出生年份。
- `age`：年龄。
- `healthLevel`：健康等级。
- `avatar`：头像路径。
- `phone`：手机号。
- `medicalHistory`：病史。
- `painAreas`：疼痛部位。
- `emergencyContact`：紧急联系人。
- `height`：身高。
- `weight`：体重。
- `note`：备注。
- `profileComplete`：资料是否完整。
- `missingFields`：缺失字段列表。
- `createdAt`：创建时间。
- `updatedAt`：更新时间。

权限建议：
- 演示阶段可先使用“仅创建者可读写”或通过云函数读写。
- 当前代码通过云函数读写，页面不直接操作集合。

### training_progress
用途：训练进度。

字段：
- `ownerOpenId`
- `completedIds`
- `currentUnlocked`
- `createdAt`
- `updatedAt`

说明：
- 当前阶段只记录“完成了哪些关卡”。
- 页面会优先读云端进度；云端失败时回退本地缓存。

### assessment_reports
用途：最近一次测评报告。

字段：
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

说明：本阶段只保存最近一次，后续保存时覆盖当前用户已有报告。

### caregiver_bindings
用途：老人端生成二维码/绑定码，保存待绑定或已绑定关系。

字段：
- `ownerOpenId`
- `elderId`
- `elderName`
- `bindingCode`
- `qrPayload`
- `status`
- `caregiverOpenId`
- `createdAt`
- `updatedAt`

说明：
- 第一阶段只保存绑定关系数据，子女端仍保持 mock。
- 老人端会生成绑定码和二维码内容字符串，并写入云数据库。

## 首次测试流程
1. 部署 `elderService`、`trainingService`、`assessmentService` 和 `bindingService` 云函数。
2. 在云开发数据库里创建 `elders`、`training_progress`、`assessment_reports` 和 `caregiver_bindings` 集合。
3. 重新编译小程序。
4. 从身份选择进入老人端注册页。
5. 填写姓名、性别、出生年份后点击“完成注册”。
6. 云数据库 `elders` 应新增或更新一条记录。
7. 首页、我的页、健康档案页会优先读取云端老人资料；云端失败时回退本地缓存。
8. 进入每日练并完成一个关卡，云数据库 `training_progress` 应新增或更新一条记录。
9. 训练地图和训练记录页会优先读取云端训练进度。
10. 完成一次测评后，云数据库 `assessment_reports` 应新增或覆盖更新一条记录。
11. 首页、我的页、健康档案页和测评报告页会优先读取云端最近一次测评报告。
12. 打开我的页里的绑定二维码弹窗，云数据库 `caregiver_bindings` 应新增一条待绑定记录。
13. 进入子女端，输入绑定码并确认，`caregiver_bindings.status` 应从 `pending` 更新为 `bound`。

## 当前限制
- 还没有真实资料完善页，所以病史、疼痛部位、紧急联系人、身高、体重、备注会先以空字段保存。
- 资料完整度会标记为 `profileComplete: false`，首页会提示后续继续完善。
- 子女端已支持手动输入绑定码确认绑定；真实扫码解析还未接入。
