---
{
  "id": "design-stage-snapshot-handoff",
  "title": "用快照交接阶段",
  "status": "draft",
  "summary": "每个阶段保存产物，下一阶段读取并校验，减少参数丢失。",
  "technologies": ["tech-stage-snapshot"]
}
---

适用于多阶段、多参数的流程。需约定产物字段和推进条件；快照本身不保证重试安全。

依据：source-b399ab1d75e7 的 5.5；重试边界为本次推断。
