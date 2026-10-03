---
{
  "id": "design-batch-independent-reductions",
  "title": "归约结构与批次大小解耦",
  "status": "draft",
  "summary": "允许组批改变并行任务数量，但保持每条输入的累加与合并顺序稳定。",
  "technologies": [
    "tech-floating-point-reduction-order",
    "tech-gemm-tiling-split-k",
    "tech-rmsnorm-row-reduction",
    "tech-attention-split-kv"
  ]
}
---

同一条输入可以与不同请求一起执行，但它内部怎样分段求和、怎样合并局部结果，应与批次大小解耦。否则浮点舍入会让执行分组的变化变成数值变化。

文章用三种实现说明这件事：GEMM 保持 K 维的累加安排稳定；RMSNorm 保持每个 token 的归约结构稳定；Attention 保持同一查询的 KV 切分及合并方式稳定。

**取舍**：固定归约安排可能限制某些性能优化，不必因此关闭所有独立任务的并行。具体性能代价需要在目标环境测量。

**依据**：来源 source-453368191f4d，PDF 第 17–25、26–33、38–41 页。保证取决于实际内核、硬件和精度，不能只凭固定了某个参数认定整个模型已确定。
