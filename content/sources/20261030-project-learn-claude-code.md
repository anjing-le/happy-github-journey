---
{
  "id": "source-learn-claude-code",
  "title": "learn-claude-code",
  "type": "open-source",
  "url": "https://github.com/shareAI-lab/learn-claude-code",
  "status": "draft",
  "receivedAt": "2026-10-30",
  "summary": "从最小工具循环逐步增加权限、知识、状态与协作机制，理解 Coding Agent 外围工程如何工作。",
  "preview": [
    {
      "label": "问题",
      "text": "直接使用 Coding Agent 容易把工具执行、上下文和任务控制都当成黑盒。"
    },
    {
      "label": "目标",
      "text": "用可阅读的小实现建立运行机制地图，知道需求出现时应该补哪一层能力。"
    }
  ],
  "designs": [
    "design-progressive-skill-loading",
    "design-code-owned-agent-control"
  ],
  "technologies": [
    "tech-agent-harness",
    "tech-mcp",
    "tech-git-worktree"
  ],
  "archive": {
    "status": "saved",
    "file": ".pocket/source-learn-claude-code/snapshot/README.md",
    "capturedAt": "2026-10-30",
    "completeness": "partial"
  }
}
---

## 问题与目标

一个 Coding Agent 能读文件、运行命令、处理长任务，背后不仅有模型，也有工具接口、权限、上下文和状态管理。learn-claude-code 是一套教学项目，用逐步增加能力的小程序把这些运行机制拆开，帮助理解它们为什么需要、怎样配合。

## 方案怎么做

起点只有一个循环：把消息和工具定义交给模型；模型提出工具调用，程序执行并返回结果；模型继续观察，直到当前轮不再调用工具。增加文件读取或编辑能力时，注册新的工具处理函数即可，不必重新设计整个循环。

接下来把约束和扩展放到明确位置：执行前检查权限，用钩子接入日志等行为；Skill 先展示名称与描述，需要时再加载全文；长历史通过压缩腾出空间，长期知识与任务状态则另行保存。

更长的工作引入子任务、后台任务、定时调度、任务依赖和消息协作，并使用独立工作目录减少并发修改互相覆盖。固定的编排可交给代码；模型想结束当前轮时，还能由独立评估步骤检查目标是否满足。它区分“这一轮说完了”和“目标已经完成”，也设置无法继续、评估失败和次数限制的出口。

## 适用条件与取舍

适合从使用 Agent 转向理解 Harness 的开发者。学习重点是每个机制处理的具体问题，可以从最小循环开始按需求增加。教学示例中的字符串黑名单和简单路径检查不能当作完整安全沙箱；独立模型评审也可能判断错误。生产系统仍需补齐隔离、持久化、并发和真实验收，不能把示例直接视为商业产品的完整复制。
