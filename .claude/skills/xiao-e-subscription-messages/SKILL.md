---
name: xiao-e-subscription-messages
description: Plan and implement WeChat Mini Program subscription messages for Xiao-E Peilian reminders, notification tasks, template IDs, requestSubscribeMessage flows, CloudBase scheduled functions, and notification database schema. Use when adding daily reminders, training reminders, caregiver alerts, or any WeChat subscribe message feature.
---

# Xiao-E Subscription Messages

Use this skill only when the task involves WeChat subscription messages or reminder notifications.

## Stop Before Coding

Before writing code, ask whether the user has:

- subscription message template ID
- template field names such as `thing1`, `date2`, `name3`
- exact template content from WeChat Public Platform
- reminder scenario: one-time, repeated, or accumulated authorization count

If template ID and field definitions are missing, stop implementation and guide the user to create the template first. Cloud function payloads depend on these fields.

## Client Principles

- `wx.requestSubscribeMessage` must be triggered by a user tap.
- Do not request permission in lifecycle hooks.
- Keep the core business flow continuing unless the feature explicitly requires authorization.
- For one-time reminders, place the request inside the relevant action button.
- For repeated reminders, show remaining authorized notification count near the business card, not hidden in settings.

## CloudBase Pattern

Suggested collection when needed:

```json
{
  "_openid": "user openid",
  "status": "ACTIVE",
  "startTime": "YYYY-MM-DD HH:mm:ss",
  "nextRemindTime": "YYYY-MM-DD HH:mm:ss",
  "interval": 86400,
  "maxCount": 1,
  "sentCount": 0,
  "templateId": "wechat template id",
  "templateData": {}
}
```

Suggested cloud functions:

- `createSubTask`
- `cancelSubTask`
- `subtaskScheduler`

Scheduler trigger example:

```json
{
  "permissions": {
    "openapi": [
      "subscribeMessage.send"
    ]
  },
  "triggers": [
    {
      "name": "subtaskScheduler",
      "type": "timer",
      "config": "0 * * * * * *"
    }
  ]
}
```

After changing trigger config, remind the user to upload trigger configuration in WeChat DevTools.

## Xiao-E Product Fit

Good scenarios:

- daily training reminder
- caregiver reminder after missed training
- health profile review reminder

Avoid building notification infrastructure during demo polish unless it directly supports the demo goal.

## Validation

- Client request is inside a tap handler.
- Template data keys match the official WeChat template fields exactly.
- Cloud function has `subscribeMessage.send` permission.
- Scheduler does not send duplicate reminders.
- User-facing text explains that authorization is controlled by WeChat.
