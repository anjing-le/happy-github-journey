---
{
  "id": "source-langgraph",
  "title": "LangGraph",
  "type": "open-source",
  "url": "https://github.com/langchain-ai/langgraph",
  "status": "draft",
  "summary": "围绕显式状态组织长任务，用检查点、中断与恢复支持需要人工参与的 Agent 流程。",
  "receivedAt": "2026-10-30",
  "designs": [
    "design-resumable-workflow-side-effects",
    "design-workflow-state-checkpoints"
  ],
  "technologies": [
    "tech-langgraph"
  ],
  "archive": {
    "status": "saved",
    "file": ".pocket/source-langgraph/snapshot-20261030/snapshot.md",
    "capturedAt": "2026-10-30",
    "completeness": "partial"
  },
  "preview": [
    {
      "label": "问题",
      "text": "复杂任务会分支、等待和失败，单个聊天循环难以管理执行进度。"
    },
    {
      "label": "目标",
      "text": "让流程状态可检查、可保存，并在约束清楚的条件下接续。"
    }
  ]
}
---

## 问题与目标

多步骤 Agent 不一定能一次完成：查询会失败，审批需要等待，用户也可能中途修改条件。LangGraph 提供偏底层的编排能力，把执行流程和状态表达出来，让这些变化有明确落点。

## 方案怎么做

一个图由节点、连接和共享状态组成。节点可以调用模型、执行工具或运行普通代码，读取状态后返回部分更新；连接与条件决定下一步，多个更新如何合并由状态规则定义。图先编译成可执行对象，再调用或流式运行。

检查点按线程保存执行状态，支持查看过程、继续会话和从中断恢复。需要人判断时，节点发出中断并携带待确认内容，客户端回传结果后继续。跨线程共享的长期知识放在独立 Store 中，避免把所有历史都混进当前流程状态。

例如报销审核可以先提取材料，缺信息时暂停，补充后继续计算与检查。但恢复并不是把程序指针原封不动放回暂停处：中断所在节点会重新执行，因此外部发送、扣款等动作必须拆分并保护幂等。

## 适用条件与取舍

适合状态复杂、持续时间长或需要人工参与的流程。生产恢复需要持久检查点，内存示例不能抵抗进程重启。它也不会自动决定业务验收标准；简单单轮任务可能无需引入图、状态合并和持久化管理。
