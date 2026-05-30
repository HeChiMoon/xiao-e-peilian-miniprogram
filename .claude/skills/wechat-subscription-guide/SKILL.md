---
name: wechat-subscription-guide
description: Invoke this skill when planning, analyzing requirements, designing architecture, or developing WeChat Mini Programs that involve subscription messages, notifications, or timed reminders. Essential for PRD analysis, database schema design for notifications, and implementing WeChat's subscription message capabilities.
---

# 微信小程序订阅消息指南 (WeChat Subscription Message Scheduler)
## 1. 微信小程序订阅消息配置开发指导
### 1.1 订阅消息配置
> **重要警示 (CRITICAL)**: 在开始编写任何代码之前，必须先询问用户是否已拥有 **订阅消息模板 ID** 和 **模板详细内容**（如 `thing1`, `date2` 等字段定义）。
> 如果用户未提供，**必须立即停止开发流程**，并引导用户去微信公众平台创建模板。
> **原因**：云函数的发送逻辑和前端的请求参数完全依赖于模板的具体字段结构。没有这些信息，生成的代码将无法工作。

如果用户没有提供订阅消息模板 ID和模板内容。请务必先提示用户要求其进行订阅消息的创建，并提供ID和模板
1. **登录微信公众平台**：使用管理员账号登录 [微信公众平台](https://mp.weixin.qq.com/)。
2. **进入“订阅消息”页面**：在左侧导航栏中，点击“订阅消息”进入订阅消息配置页面。
3. **添加订阅消息模板**：点击“添加订阅消息模板”，填写模板名称、模板内容、相关字段（如用户姓名、订单号等），并提交。
4. **获取模板 ID**：添加成功后，系统会生成一个模板 ID，用于后续调用。
5. **拷贝模板 ID**：将模板 ID 复制到小程序端代码中，用于后续调用 API 发送消息。 参考 ./reference/wechat-subscription-message.md 将提供的消息转换为模板代码
### 1.2 小程序客户端处理指导

#### 场景一：订阅消息权限申请融入业务流程
**适用场景**：一次性任务，如“提交订单”、“预约单次提醒”。

**核心原则**：
1. **隐形植入**：将订阅请求埋点在核心业务按钮（如“开始任务”）的点击事件中。
2. **流程连贯**：无论用户是否同意订阅，都必须保证业务逻辑（如提交表单）能继续执行, 如果必须使用到通知的功能请提示用户授权才能保证功能完整性

**代码示例**：
```javascript
handleStartTask() {
  const TEMPLATE_ID = 'your_template_id';
  wx.requestSubscribeMessage({
    tmplIds: [TEMPLATE_ID],
    complete: (res) => {
      // 无论订阅成功与否，都执行业务逻辑
      this.executeTaskLogic();
    }
  });
}
```

#### 场景二：需要多次订阅消息权限申请用于满足业务需求
**适用场景**：例如需要长期循环提醒的任务，如“每天打卡提醒”、“库存监控”。因微信限制每次授权只能发一次，用户需多次点击累积授权次数。

**设计原则**：
1. **就近原则**：独立订阅按钮应直接嵌入在**当前业务操作视图**中（如任务详情卡片内），而不是放在单独的“设置”页面。
2. **可视化反馈**：按钮文案应体现“增加次数”的含义（如“+1次提醒”），并实时展示当前剩余可通知次数。

**代码示例**：
```wxml
<!-- WXML: 任务详情卡片内 -->
<view class="task-card">
  <view>剩余提醒次数：{{remindCount}}</view>
  <!-- 嵌入在业务视图中的独立按钮，方便用户快速连续点击 -->
  <button size="mini" bindtap="handleAddChance">增加提醒次数 (+1)</button>
</view>
```

```javascript
// JavaScript
handleAddChance() {
  wx.requestSubscribeMessage({
    tmplIds: ['TEMPLATE_ID'],
    success: (res) => {
      if (res['TEMPLATE_ID'] === 'accept') {
        this.setData({ remindCount: this.data.remindCount + 1 });
        wx.showToast({ title: '次数+1' });
      }
    }
  });
}
```

### 注意事项
**权限限制**: 必须在用户点击事件中调用，不能在回调或生命周期中调用。
### 小程序云端处理指导
1. 创建云函数: 在小程序项目中创建一个云函数，用于处理订阅消息的发送逻辑。
2. 关于如何处理模板数据、接口参数、示例代码请务必参考 ./reference/wechat-subscription-message.md 


## 2. 如何基于订阅消息实现定时发送订阅消息功能

本方案通过参数配置即可覆盖单次提醒、循环提醒及无限循环提醒。

### 核心逻辑
1.  **开始时间 (Start Time)**: 任务触发的时间，采用标准时间字符串格式（如 `2023-10-21 10:32:32`）。
2.  **通知次数 (Count)**:
    *   **指定次数**: 设置 `maxCount` 为正整数（如 1, 2, 3, ……），发送指定次数后任务自动结束 (`status` 变为 `finish`)。
    *   **无限循环**: 设置 `maxCount` 为 **-1**，任务将无限期执行，直到用户或系统主动将任务状态设置为 `finish`。
3.  **时间格式**: 所有时间字段均使用 `YYYY-MM-DD HH:mm:ss` 格式字符串，便于数据库直接查看和调试。

### 业务流程
1. **创建通知任务**：在小程序客户端填写并提交任务参数：开始时间、通知间隔、通知次数、模板 ID、用户 ID 等，随后调用云函数 `createSubTask` 将任务持久化至云数据库。  
调用成功后，小程序端可立即获得任务 ID，用于后续查询或取消。
2.  **定时扫描**: 云函数 `SubtaskScheduler` 每分钟触发一次，查询数据库中所有状态为 `ACTIVE` 且 开始时间小于等于当前时间的任务。
3.  **消息发送**: 对每个触发任务，调用微信订阅消息 API 发送消息，更新任务的已发送次数（`sentCount`）。
4.1  **任务结束**: 当任务已发送次数（`sentCount`）达到 `maxCount`（或用户主动将状态设为 `FINISH`），将任务状态设为 `FINISH`。
4.2  **主动任务结束**: 小程序客户调用云函数 `cancelSubTask` 并传入任务 ID，将任务状态设为 `FINISH`。

### 数据库设计 (Schema)
建议在云数据库创建集合 `subscription_tasks`。
```json
{
  "_id": "task_id_example",
  "_openid": "user_openid",
  "status": "ACTIVE", // ACTIVE | FINISH
  "startTime": "2023-10-21 10:32:32", // 提醒开始时间
  "nextRemindTime": "2023-10-21 10:32:32", // 下一次提醒时间(初始化时与startTime相同)
  "interval": 60, // 通知间隔，单位：秒
  "maxCount": 5, // 最大通知次数，-1 表示无限循环
  "sentCount": 0, // 已发送次数
  "templateId": "wechat_template_id", // 订阅消息模板ID
  "externargs": { // 额外数据，用于模板信息填充
    "arg1": "xxx",
    "arg2": "xxx",
  }
}
```

### 云函数实现模板
创建 createSubTask、SubtaskScheduler、cancelSubTask 三个云函数。
#### createSubTask
1. 生成任务 ID 
2. 将任务参数（开始时间、通知间隔、下一次提醒时间(和开始时间相同)、通知次数、模板 ID、用户 ID 等）存储到数据库中,并设置任务状态为 `ACTIVE`。
3. 并返回任务 ID 给小程序端。
#### cancelSubTask
1. 接收任务 ID 作为参数，将数据库中对应任务的状态设为 `FINISH`。
#### SubtaskScheduler
1. 每分钟触发一次，查询数据库中所有状态为 `ACTIVE` 且 开始时间小于等于当前时间的任务。
2. 对每个触发任务，调用微信订阅消息 API 发送消息，并更新任务信息
参考代码片段:
**数据库过滤**
```javascript
const _ = db.command
const now = new Date()

// status = 'ACTIVE' AND nextRemindTime <= now
// 限制每次处理的数量，防止超时
const tasks = await db.collection('subscription_tasks')
  .where({
    status: 'ACTIVE',
    nextRemindTime: _.lte(now)
  })
  .limit(30)
  .get()
```

**发送订阅消息**
需要用户ID、模板ID、模板数据等
关于如何处理模板数据、接口参数、示例代码请务必参考 ./reference/wechat-subscription-message.md 

**任务状态更新**
1.  发送成功后，更新任务的 `nextRemindTime` 为下一次提醒时间（当前时间 + 通知间隔），并增加 `sentCount` 已发送次数。
2.  当任务已发送次数（`sentCount`）达到 `maxCount`（或用户主动将状态设为 `FINISH`），将任务状态设为 `FINISH`。

#### 配置定时触发器
为SubtaskScheduler云函数 创建 config.json, 配置每分钟定时器
```json
{
  "permissions": {
    "openapi": [
      "subscribeMessage.send"
    ]
  },
  "triggers": [
    {
      "name": "myTimer",
      "type": "timer",
      "config": "0 * * * * * *"
    }
  ]
}
```
**定时触发器配置说明**：
- `"0 * * * * * *"` 表示每分钟的第0秒执行一次
- 可以根据需要调整执行频率

**注意**: 配置或者修改触发器配置文件之后需要提醒用户在微信小程序开发页面对应云函数下的config.json文件右键点击上传触发器