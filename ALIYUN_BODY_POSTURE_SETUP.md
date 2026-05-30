# 阿里云 BodyPosture 接入说明

更新时间：2026-05-17

## 当前结论

阿里云 `BodyPosture` 不接受微信云存储临时链接。当前项目已经改为：

老人端拍照 -> 上传微信云存储 -> `poseService` 下载图片 -> 上传到阿里云 OSS 上海 Bucket -> 使用 OSS 标准域名签名 URL 调用 `BodyPosture` -> 转换关键点 -> 计算膝关节角度 -> 保存到 `pose_detection_records`。

## 必须配置的环境变量

不要把 `AccessKey.csv` 写入代码，也不要上传到代码仓库。当前项目已经把 `AccessKey.csv` 加入 `.gitignore`。

请在微信开发者工具或云开发控制台中给 `poseService` 云函数配置：

| 变量名 | 说明 |
|-|-|
| `ALIYUN_ACCESS_KEY_ID` | 阿里云 AccessKey ID |
| `ALIYUN_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret |
| `ALIYUN_OSS_BUCKET` | 阿里云 OSS Bucket 名称，必须建议创建在华东 2（上海） |

可选变量：

| 变量名 | 默认值 | 说明 |
|-|-|-|
| `ALIYUN_FACEBODY_ENDPOINT` | `facebody.cn-shanghai.aliyuncs.com` | BodyPosture 接口域名 |
| `ALIYUN_FACEBODY_IP` | 空 | 当微信云函数无法解析 BodyPosture 域名时使用，填一个当前可解析到的公网 IP |
| `ALIYUN_OSS_ENDPOINT` | `oss-cn-shanghai.aliyuncs.com` | OSS 标准域名，不要填 CDN 或自定义域名 |
| `ALIYUN_OSS_PREFIX` | `xiao-e-pose` | 上传到 OSS 的对象前缀 |

云函数执行超时建议改成 `20 秒`。当前链路包含微信云存储下载、OSS 上传和 BodyPosture 识别，`3 秒` 很容易超时。

## OSS Bucket 要求

1. 到阿里云 OSS 创建 Bucket。
2. 地域选择：华东 2（上海）。
3. Bucket 名称填到 `ALIYUN_OSS_BUCKET`。
4. 读写权限可以保持私有；云函数会生成带签名的临时 URL 给 BodyPosture 访问。
5. AccessKey 需要至少具备该 Bucket 的 `PutObject` 权限。

## 云函数行为

`poseService` 支持以下姿态检测入口：

| action | 当前用途 |
|-|-|
| `analyzeImage` | 新链路，接收图片 `fileID` 并调用阿里云 BodyPosture |
| `analyzeVideo` | 兼容旧入口，内部走同一套分析逻辑 |

BodyPosture 返回结果会优先按阿里云官方结构解析：

```text
Data.Outputs[].Results[].Bodies[].Label
Data.Outputs[].Results[].Bodies[].Positions.Points[0/1]
Data.Outputs[].Results[].Bodies[].Confident
```

如果官方结构未命中，再回退到兼容型 keypoints 解析。

识别结果中的 `engine` 字段用于判断实际引擎：

| engine | 含义 |
|-|-|
| `aliyun-body-posture-v1` | 已调用阿里云 BodyPosture 并成功解析关键点 |
| `mock-fallback-no-aliyun-config` | 没有配置阿里云 AccessKey |
| `mock-fallback-aliyun-failed` | OSS 中转、阿里云调用或关键点解析失败 |

如果出现 fallback，记录中会保存 `apiError`，可在数据库或云函数日志中查看原因。

## 云存储和 OSS 路径

微信云存储：

```text
pose-detections/{actionKey}/{timestamp}-{random}.jpg
```

阿里云 OSS 中转：

```text
{ALIYUN_OSS_PREFIX}/{actionKey}/{timestamp}-{random}.jpg
```

## 数据库字段

`pose_detection_records` 继续使用现有结构，并增加：

| 字段 | 说明 |
|-|-|
| `mediaType` | 当前为 `image` |
| `ossObjectKey` | 上传到阿里云 OSS 的对象路径，成功上传时保存 |
| `engine` | 分析引擎标识 |
| `apiProvider` | `aliyun` 或 `mock` |
| `apiRequestId` | 阿里云请求 ID，成功时保存 |
| `apiError` | fallback 原因 |

## 验证步骤

1. 配置 `ALIYUN_ACCESS_KEY_ID`、`ALIYUN_ACCESS_KEY_SECRET`、`ALIYUN_OSS_BUCKET`。
2. 确认 `ALIYUN_OSS_ENDPOINT` 为 `oss-cn-shanghai.aliyuncs.com`，可不填。
3. 把 `poseService` 超时改为 `20 秒`。
4. 上传并部署 `cloudfunctions/poseService`。
5. 老人端进入 `首页 -> 膝关节检测`。
6. 选择动作，点击“拍照检测”。
7. 检查 `pose_detection_records` 最新记录：
   - `engine = aliyun-body-posture-v1`：真实识别成功。
   - `engine = mock-fallback-aliyun-failed`：查看 `apiError`。
8. 检查 OSS Bucket 中是否出现 `xiao-e-pose/` 开头的图片对象。

## 网络诊断

如果 `apiError` 出现 `getaddrinfo ENOTFOUND facebody.cn-shanghai.aliyuncs.com`，说明云函数运行环境无法解析阿里云 BodyPosture 域名。

可在云函数测试中调用：

```json
{
  "action": "diagnoseNetwork"
}
```

返回结果会检查：

- `facebody.cn-shanghai.aliyuncs.com`
- `oss-cn-shanghai.aliyuncs.com`
- `{ALIYUN_OSS_BUCKET}.oss-cn-shanghai.aliyuncs.com`

排查顺序：

1. `ALIYUN_FACEBODY_ENDPOINT` 只填域名，不要带 `https://`、路径或空格。
2. 如果没有特别需要，可以删除 `ALIYUN_FACEBODY_ENDPOINT`，让代码使用默认值。
3. 如果 OSS 域名可解析但 `facebody.cn-shanghai.aliyuncs.com` 仍然 `ENOTFOUND`，可新增 `ALIYUN_FACEBODY_IP`，填你本机解析到的一个 IP，例如 `106.15.83.32`。代码会用 IP 建连，但 `Host` 和 TLS SNI 仍使用官方域名。
4. `ALIYUN_FACEBODY_IP` 只是 DNS 兜底，阿里云 IP 可能变化；如果后续又失败，重新解析官方域名并更新这个变量。
5. 确认云函数没有绑定无法访问公网的私有网络配置。
6. 重新部署云函数后再测试。

## 当前边界

- 本阶段只做链路 A：单帧膝关节检测。
- 训练页实时纠错链路 B 还没有接入阿里云抽帧。
- 暂不引入 WebSocket。
- 暂不把子女端和管理员端改为真实姿态数据看板。
