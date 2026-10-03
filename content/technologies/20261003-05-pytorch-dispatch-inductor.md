---
{
  "id": "tech-pytorch-dispatch-inductor",
  "title": "PyTorch 算子分发与 Inductor",
  "status": "draft",
  "summary": "直接执行与编译执行可走不同内核，优化后的实际路径需要分别核对。"
}
---

eager 模式直接调用算子实现；`torch.compile` 可捕获计算图，再经 Inductor 优化、生成或调用内核。文章中的 vLLM 分发还会结合精度、硬件与形状选择实现。

编译与融合可能绕开 eager 的自定义覆盖，或按输入形状生成不同的 Split-Reduction。它把一行规约拆给多个任务再合并，因此拆分变化可能破坏批次不变。

这解释了为什么必须检查最终执行路径，而不能只检查开关与入口函数。文中的形状阈值依赖编译版本和配置，不作为通用规则保存。

**依据**：来源 source-453368191f4d，PDF 第 18、22、29–36 页。
