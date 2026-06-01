# 小鹅陪练 AI Skills

更新时间：2026-06-01

本目录用于保存小鹅陪练项目专属 AI skills。它们参考 `mattpocock/skills` 的思路，把项目上下文、需求澄清、Bug 诊断、云开发、姿态识别和 Demo 收尾流程沉淀为可复用工作法。

## 使用原则

日常沟通照常。

长输出先过 RTK。

开发任务由 AI 直接查项目、分析、修改和验证。

## RTK 使用规则

在 WSL 中进入项目：

```bash
xiao
```

常用命令：

```bash
rtk git status
rtk diff
rtk read PROJECT_STATUS.md
rtk read README.md
rtk grep "关键词" miniprogram cloudfunctions
rtk gain -p
```

适合使用 RTK 的场景：

- 查看 Git 状态、diff、日志
- 搜索关键词
- 阅读长文档或长输出
- 压缩构建、测试、云函数报错输出

提交和推送前的最终判断：

- RTK 可以辅助查看状态，但不能作为最终 Git 判断。
- 由于 WSL 和 Windows Git 可能因为 CRLF/LF 换行差异产生不同状态，最终以 Windows PowerShell 中的 `git status --short`、`git diff`、`git log` 为准。
- 推送前必须确认工作区干净、提交内容明确，并同时检查 GitHub `origin/main` 和微信 Git `wechat/main`。

不适合只依赖 RTK 的场景：

- 准备直接编辑文件
- 需要精确行号和完整上下文
- RTK 输出被过度压缩或看不清根因

这种情况下应回到原始文件或原始命令。

## Skills 清单

- `xiao-e-project-context`：项目上下文、术语、边界、交接事实。
- `xiao-e-grill-requirements`：新功能前的需求澄清与计划。
- `xiao-e-diagnose-bug`：复杂问题诊断与复检。
- `xiao-e-cloudbase-dev`：微信云开发、云函数、CloudDB、数据隔离。
- `xiao-e-pose-ai`：姿态识别、动作评分、训练检测。
- `xiao-e-demo-polish`：Demo 收尾、UI 打磨、文档同步、演示准备。

## 项目内源文件与本机安装副本

项目内源文件位于：

```text
docs/ai-skills/
```

本机 Codex 自动发现副本位于：

```text
C:\Users\HP\.codex\skills\
```

更新时建议先改 `docs/ai-skills/`，再同步到本机 Codex skills 目录。

