---
{
  "id": "source-deepseek-harness",
  "title": "DeepSeek Harness（dsh）",
  "type": "open-source",
  "url": "https://github.com/deepseek-ai/deepseek-harness",
  "status": "draft",
  "summary": "用可替换插件组合模型、工具、会话和界面，并用持久事件记录连接执行与恢复。",
  "receivedAt": "2026-10-30",
  "designs": [
    "design-dsh-lifecycle-composition"
  ],
  "technologies": [
    "tech-agent-harness"
  ],
  "archive": {
    "status": "saved",
    "file": ".pocket/source-deepseek-harness/snapshot.md",
    "capturedAt": "2026-10-30",
    "completeness": "partial"
  },
  "preview": [
    {
      "label": "问题",
      "text": "Agent 平台能力越堆越多，接入新模型或运行环境常常牵动核心代码。"
    },
    {
      "label": "目标",
      "text": "让能力按明确接口组合和替换，同时保留可恢复、可核对的执行过程。"
    }
  ]
}
---

## 问题与目标

Agent 的运行环境不只是一个模型调用循环，还包括工具、文件操作、会话、权限策略和界面。DeepSeek Harness 把这些能力都组织成插件，希望改变其中一项时，可以调整组合而不必复制整个系统。

## 方案怎么做

底层采用 Cordis：插件提供服务、订阅事件，并声明依赖。模型适配器、工具注册表、会话日志甚至默认 Agent 循环都可以替换。不同启动配置组合成 Web、无界面运行和 SDK 等形态，公共能力由基础组合提供，上层配置按明确顺序覆盖。

运行过程把持久事实与实时事件分开。收到的输入、模型输出和工具结果进入会话日志，模型上下文由日志构建；流式输出等实时通知负责让界面及时响应。恢复、分叉和后续查看有共同事实依据，不必各自猜测已经发生了什么。

工具执行经过统一的校验与策略环节，插件可以在明确位置扩展。创建的注册和资源跟随所属插件清理；依赖卸载时，需要等待相关工作结束，避免留下失去归属的任务。例如切换文件与进程服务时，共用这些接口的工具可以随运行环境一起迁移。

## 适用条件与取舍

适合研究可组合的 Agent 平台，或需要深度替换运行能力的开发场景。插件与事件越灵活，依赖顺序、配置覆盖和资源清理越需要约束。项目仍处于开发预览，接口可能变化；存在沙箱与批准机制，也不代表已具备经过审计的生产隔离能力。
