---
{
  "id": "design-batch-independent-reductions",
  "title": "固定单条输入的求和结构",
  "status": "draft",
  "summary": "批次可以变化，但同一输入内部的分组求和与合并方式要稳定。",
  "preview": [
    {
      "label": "方法",
      "text": "把每条输入的求和分组和合并固定下来。"
    },
    {
      "label": "用途",
      "text": "减少组批变化引起的数值波动。"
    }
  ],
  "technologies": [
    "tech-floating-point",
    "tech-rounding",
    "tech-reduction",
    "tech-gemm",
    "tech-split-k",
    "tech-atomic-add",
    "tech-workspace",
    "tech-rmsnorm",
    "tech-attention",
    "tech-softmax",
    "tech-split-kv"
  ]
}
---

## 怎么做

区分两类并行：不同输出可以分别计算；同一个输出内部怎样分段求和、怎样合并，需要单独控制。批次改变时，尽量让后者保持稳定。

矩阵乘法、RMSNorm 和 Attention 都有内部汇总步骤。可以固定分组与合并配置，或限制会随负载改变的 Split-K、Split-KV 等拆分。

## 为什么

浮点数每次相加都可能舍入。输入和公式相同，只要分组或合并顺序改变，数值就可能变化。

## 何时使用

需要同一请求在不同组批条件下得到一致结果时。限制拆分可能降低小批次的并行度；是否达到目标，要在实际环境中对照不同批次检验，不能只看开关是否设置。
