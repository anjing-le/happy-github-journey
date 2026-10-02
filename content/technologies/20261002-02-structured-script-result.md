---
{
  "id": "tech-structured-script-result",
  "title": "结构化 JSON 输出",
  "status": "draft",
  "summary": "脚本返回可解析的字段，让 Agent 按明确的状态继续处理。"
}
---

JSON 解决结果格式；调用方仍需检查成功、失败与降级状态，不能只看输出存在。

依据：source-b399ab1d75e7 的 5.4；状态处理为实现建议，不代表已验证内部代码。
