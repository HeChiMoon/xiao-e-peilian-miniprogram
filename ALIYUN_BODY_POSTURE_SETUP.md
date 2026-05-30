# 阿里云 BodyPosture 接入说明

更新时间：2026-05-31

## 1. 当前结论

阿里云 `BodyPosture` 不能直接读取微信云存储临时链接。当前项目已经固定为以下链路：

老人端拍照 -> 上传微信云存储 -> `poseService` 下载图片 -> 上传阿里云 OSS 上海 Bucket -> 生成 OSS 标准域名签名 URL -> 调用 `BodyPosture` -> 转换关键点 -> 计算膝关节角度 -> 保存到 `pose_detection_records`

## 2. 必须配置的环境变量

不要把 `AccessKey.csv` 写进代码，也不要上传到仓库。

请给 `poseService` 云函数配置：

| 变量名 | 说明 |
| - | - |
| `ALIYUN_ACCESS_KEY_ID` | 阿里云 AccessKey ID |
| `ALIYUN_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret |
| `ALIYUN_OSS_BUCKET` | 阿里云 OSS Bucket 名称，建议华东 2（上海） |

可选变量：

| 变量名 | 默认值 | 说明 |
| - | - | - |
| `ALIYUN_FACEBODY_ENDPOINT` | `facebody.cn-shanghai.aliyuncs.com` | BodyPosture 接口域名 |
| `ALIYUN_FACEBODY_IP` | 空 | 当微信云函数无法解析域名时作为 DNS 兜底 |
| `ALIYUN_OSS_ENDPOINT` | `oss-cn-shanghai.aliyuncs.com` | OSS 标准域名 |
| `ALIYUN_OSS_PREFIX` | `xiao-e-pose` | 上传到 OSS 的对象前缀 |

建议把 `poseService` 超时配置到 `20 秒`，避免下载、上传、识别链路过长导致超时。

## 3. OSS Bucket 要求

1. 创建阿里云 OSS Bucket
2. 地域选择华东 2（上海）
3. Bucket 名称填入 `ALIYUN_OSS_BUCKET`
4. 读写权限可保持私有
5. AccessKey 至少具备该 Bucket 的 `PutObject` 权限

## 4. 当前 `poseService` 行为

当前主要入口：

| action | 当前用途 |
| - | - |
| `analyzeImage` | 主入口，接收图片 `fileID` 并调用阿里云识别 |
| `getLatest` | 读取最近一次姿势检测 |
| `listHistory` | 读取姿势检测历史 |
| `getDetail` | 读取单条姿势检测详情 |
| `clearMine` | 清空当前账号姿势检测记录 |
| `listStandards` | 读取动作标准 |
| `initStandards` | 初始化动作标准 |
| `diagnoseNetwork` | 检查阿里云域名解析情况 |

## 5. 当前识别结果状态

`engine` 字段现在用于判断实际识别结果：

| engine | 含义 |
| - | - |
| `aliyun-body-posture-v1` | 阿里云识别成功并解析出可用关键点 |
| `aliyun-config-missing` | 缺少阿里云配置，未真正发起识别 |
| `aliyun-request-failed` | OSS 中转、阿里云调用或关键点解析失败 |

说明：

- 当前不再把失败写成旧的 mock fallback 命名
- 页面层会把底层失败转成老人可读的友好中文提示

## 6. 当前数据库字段

`pose_detection_records` 当前会重点写入：

| 字段 | 说明 |
| - | - |
| `mediaType` | 当前为 `image` |
| `ossObjectKey` | 上传到阿里云 OSS 的对象路径 |
| `engine` | 分析引擎状态 |
| `apiProvider` | 当前固定为 `aliyun` |
| `apiRequestId` | 阿里云请求 ID，成功时保存 |
| `apiError` | 失败原因 |

## 7. 当前动作范围

当前姿势识别只保留 3 个动作：

1. 靠墙静蹲
2. 直腿抬高
3. 单腿站立

说明：

- 直腿抬高当前只保留坐姿版
- 仰卧版已暂停，不作为当前 Demo 主方案

## 8. 验证步骤

1. 配置 `ALIYUN_ACCESS_KEY_ID`、`ALIYUN_ACCESS_KEY_SECRET`、`ALIYUN_OSS_BUCKET`
2. 确认 `ALIYUN_OSS_ENDPOINT` 为 `oss-cn-shanghai.aliyuncs.com`
3. 把 `poseService` 超时改为 `20 秒`
4. 上传并部署 `cloudfunctions/poseService`
5. 从老人端进入相机检测页
6. 选择动作后手动拍照检测
7. 检查 `pose_detection_records` 最新记录：
   - `engine = aliyun-body-posture-v1`：真实识别成功
   - `engine = aliyun-request-failed`：查看 `apiError`
   - `engine = aliyun-config-missing`：检查环境变量
8. 检查 OSS Bucket 中是否出现 `xiao-e-pose/` 开头的图片对象

## 9. 网络诊断

如果 `apiError` 出现 `getaddrinfo ENOTFOUND facebody.cn-shanghai.aliyuncs.com`，说明云函数环境无法正确解析阿里云域名。

可在云函数测试中调用：

```json
{
  "action": "diagnoseNetwork"
}
```

返回会检查：

- `facebody.cn-shanghai.aliyuncs.com`
- `oss-cn-shanghai.aliyuncs.com`
- `{ALIYUN_OSS_BUCKET}.oss-cn-shanghai.aliyuncs.com`

排查顺序建议：

1. `ALIYUN_FACEBODY_ENDPOINT` 只填域名，不要带 `https://`
2. 若无需特殊配置，可删掉 `ALIYUN_FACEBODY_ENDPOINT` 使用默认值
3. 若 OSS 域名可解析但 FaceBody 不可解析，可设置 `ALIYUN_FACEBODY_IP`
4. `ALIYUN_FACEBODY_IP` 只是 DNS 兜底，后续 IP 变化时需要重新更新
5. 重新部署云函数后再次验证

## 10. 当前边界

- 当前只做单帧图片姿势检测
- 当前主检测入口是独立相机检测页
- 暂不做实时 WebSocket 姿态纠错
- 暂不把子女端和管理员端扩展成真实姿态数据工作台
