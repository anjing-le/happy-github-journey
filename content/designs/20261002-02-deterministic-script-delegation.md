---
{
  "id": "design-deterministic-script-delegation",
  "title": "确定性步骤交给脚本",
  "status": "draft",
  "summary": "将检查、计算与文件操作写成脚本，让 Agent 编排并判断结果。",
  "technologies": ["tech-structured-script-result"]
}
---

规则明确且会重复执行的步骤适合脚本化。工程建议：必要检查失败时阻止依赖步骤，可选日志失败可降级。

依据：source-b399ab1d75e7 的 5.4；失败策略为本次工程判断，未核实内部脚本实现。
