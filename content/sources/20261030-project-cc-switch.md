---
{
  "id": "source-cc-switch",
  "title": "CC Switch",
  "type": "open-source",
  "url": "https://github.com/farion1231/cc-switch",
  "status": "draft",
  "receivedAt": "2026-10-30",
  "summary": "把多个 AI 工具的供应商配置与扩展集中管理，并用局部配置变更和可选路由降低切换成本。",
  "preview": [
    {
      "label": "问题",
      "text": "多个 AI 客户端使用不同配置文件，切换服务时容易手工出错或覆盖已有设置。"
    },
    {
      "label": "目标",
      "text": "在保留各客户端使用习惯的同时，集中管理连接、扩展和可选的请求路由。"
    }
  ],
  "designs": [
    "design-recoverable-client-config-switch",
    "design-bounded-provider-failover"
  ],
  "technologies": [
    "tech-mcp",
    "tech-agent-skill"
  ],
  "archive": {
    "status": "saved",
    "file": ".pocket/source-cc-switch/snapshot/README.md",
    "capturedAt": "2026-10-30",
    "completeness": "partial"
  }
}
---

## 问题与目标

同时使用多个 AI 编程工具时，服务地址、密钥、模型、MCP 和 Skill 分散在不同文件与目录。CC Switch 提供桌面管理界面，把重复配置集中起来，同时适配每个客户端自己的文件格式与生效方式。

## 方案怎么做

应用用 Tauri 连接界面与本地能力，内部保存供应商等记录，再通过客户端适配层写入实际配置。不同工具可能一次只使用一个供应商，也可能保留多个供用户在工具中选择，因此不能把所有客户端都当成简单替换同一份 JSON。

配置变更明确字段归属：地址、凭据和模型等由供应商管理，用户已有的插件、钩子等设置尽量留在原文件。写入前先生成局部补丁、检查当前文件并准备暂存内容，再记录发布意图与进度；中途失败时据此恢复，避免界面显示已经切换而文件只改了一半。

可选的本地路由承担协议转换、供应商选择和故障切换。失败达到条件的服务会暂时熔断，恢复时少量探测；备用队列和尝试次数限制总开销。MCP、Skill 和提示词则按各工具约定同步，用量与会话界面帮助观察实际使用情况。

## 适用条件与取舍

适合经常在多个客户端和服务之间切换的开发者。配置管理成功不代表上游能力兼容，也不保证运行中的客户端立即读取新配置。本地路由增加了一个需要维护的组件，格式转换可能无法保留所有专有能力；切换还要守住账号和会话边界，不能无条件把失败请求转给任何备用服务。
