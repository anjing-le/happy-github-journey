---
{
  "id": "tech-attention-split-kv",
  "title": "Attention 的 KV 切分与合并",
  "status": "draft",
  "summary": "查询轴可独立并行，KV 轴需要归约；固定 KV 拆分与合并，避免批次通过启发式改变浮点求和顺序。"
}
---

## 查询轴与 KV 轴承担不同工作

给定 Q、K、V 后，Attention 先计算 Q 与 K 的点积，经缩放和 mask 得到分数，再沿 KV 序列做 Softmax，最后对 V 加权求和。

不同 query 的结果可以独立计算，沿查询轴切成 Q tile 主要改变并行任务的数量。同一个 query 则需要整合多个 KV token：QK 点积沿 head_dim 归约，Softmax 和 `P×V` 沿 KV 序列归约。不能把查询轴分块与 KV 轴拆分视为同一种数值操作。

## FlashAttention 怎样融合计算

文章的图示让一个 CTA 负责一个 Q tile，逐块遍历 K/V，融合完成 QK 点积、online softmax 和输出累加。Online softmax 在读取后续 KV 块时维护最大值及归一化量，并相应缩放之前的累加结果；无需先生成完整分数矩阵再执行 Softmax。

中间分数和概率保留在片上，减少写回 HBM；最终写出输出与 LSE（log-sum-exp，供后续归一化或合并使用）。查询块宽度主要组织哪些 query 一起计算；KV 块宽度会参与局部 Softmax 与加权求和的分组。相关 tile 参数及选择条件要按实际后端核对，不能仅由数学公式推出逐 bit 一致。

## FlashDecoding 为什么拆 KV

Decode 时每请求通常只有一个新 query，而历史 KV 可以很长。小批次下，若每个 query 只分配一个 CTA，可能无法提供足够并行任务。Split-KV 把同一 query 的 KV 区间分给多个 CTA，各自得到局部输出和 LSE，再按归一化关系合并成最终结果。

这个合并在数学上等价于跨段 online softmax，但有限精度下仍受到分组顺序影响。若批次变化使 `num_splits` 改变，局部结果与合并拓扑也可能改变；固定负载的重复运行稳定，不等于跨批次稳定。

按文章分析的 vLLM v0.25.1 FlashAttention 路径，批次不变模式将 `num_splits` 设为 1，避免这一类动态 KV 拆分。代价是小批次 decode 的可用并行度可能下降，实际吞吐损失未在本项目测量。

## chunked prefill 的间接影响

Chunked prefill 在调度层按 token 预算把 prompt 分到多个 step；Q tile 则在 kernel 内切分本 step 的 query，两者都沿查询轴进行。给定相同输入、因果 mask 和 KV 访问范围，这种查询分块本身不要求在不同 query 块间合并结果。

但 chunk 大小决定 kernel 看到的 `query_len`，进而影响并行 Q tile 数量与 Split-KV 启发式。较大的 chunk 可能已有足够并行任务；退化到接近 decode 的长度时，可能再次触发 KV 拆分。因此“查询分块不需跨块归约”不能推导为整个执行链不会受调度影响。

## 边界与依据

固定任意分片数量不是通用保证，还需覆盖局部计算、合并实现及上游 Q/K/V 的稳定性。以上是文章所述机制与路径，未运行 GPU 实验，不承诺所有 FlashAttention 后端或版本采用相同策略。

**依据**：来源 source-453368191f4d，PDF 第 36–41 页。
