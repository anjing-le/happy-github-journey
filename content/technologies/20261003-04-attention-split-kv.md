---
{
  "id": "tech-attention-split-kv",
  "title": "Attention 的 KV 切分与合并",
  "status": "draft",
  "summary": "查询可独立并行；同一查询的 KV 分区与局部结果合并决定归约结构。"
}
---

Attention 对每个查询沿 KV 序列计算 Softmax 与加权求和。FlashDecoding 可把 KV 序列分给多个 CTA，得到局部输出和归一化信息，再合并成一个结果。

组批若改变 KV 的切分或合并方式，可能改变舍入结果。应让同一查询的 KV 归约安排不随其他请求变化；文章分析的 vLLM v0.25.1 FlashAttention 路径采用 `num_splits=1`。

**边界**：固定任意分片数量并不是通用保证。分块预填充本身的查询切分不需跨块归约，但查询长度仍可能通过启发式影响 KV 切分。

**依据**：来源 source-453368191f4d，PDF 第 36–41 页。
