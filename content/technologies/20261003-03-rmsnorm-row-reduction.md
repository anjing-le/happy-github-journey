---
{
  "id": "tech-rmsnorm-row-reduction",
  "title": "RMSNorm 的逐 token 归约",
  "status": "draft",
  "summary": "每个 token 沿 hidden 维独立求平方和，固定该求和结构以避免批次影响。"
}
---

RMSNorm 先沿一个 token 的 hidden 维求平方均值，再除以 `sqrt(mean(x*x) + eps)`，并乘逐维权重。不同 token 可以独立处理，批次大小主要改变行数。

若 batch 变化又触发线程分配、逻辑规约宽度或编译内核变化，同一行的求和仍可能改变。文章讨论了 CUDA BlockReduce 与固定逻辑 BLOCK_SIZE 的 Triton 实现，用稳定的逐行归约支撑批次不变。

**边界**：逻辑 BLOCK_SIZE 不等于 CUDA 线程数；hidden 长度固定也不证明所有运行与编译路径都稳定。

**依据**：来源 source-453368191f4d，PDF 第 26–36 页。
