---
{
  "id": "tech-rmsnorm-row-reduction",
  "title": "RMSNorm 的逐 token 归约",
  "status": "draft",
  "summary": "每个 token 独立归一化，但线程配置和编译拆分仍需与批次解耦，才能保持同一行的求和结构。"
}
---

## 一行怎样归一化

输入形状为 `[num_tokens, hidden_size]`。RMSNorm 对每个 token 的 hidden 维求平方均值，再计算 `rsqrt(mean(x*x) + eps)`，把该缩放系数乘到这一行每个元素上，最后乘逐维权重。不同 token 之间不需要互相归约。

第 27 页 CUDA 代码图展示：线程先累加自己负责的元素平方，CUB BlockReduce 合并为全行平方和；一个线程计算缩放系数并写入共享存储，经块内同步后，所有线程完成输出。第 32–33 页 Triton 代码图则按固定逻辑宽度循环读取一行，以 FP32 累加平方和，处理末尾 mask，再归一化、乘权重并转回输出类型。

## 为什么按批次优化会改变结果

一行由一个 thread block 负责，可避免这一行的跨 block 同步。批次大小改变的是行数，但性能策略仍可能改变行内的线程数。

文章所示普通 CUDA 路径在 `num_tokens < 256` 时把 block 上限设为 1024，否则设为 256；实际线程数还受 hidden 长度及向量化宽度限制。行数少时用更多线程处理一行，减少每线程循环；行数多时用较小 block，让更多 block 同时驻留，并降低块内同步成本。这是适应负载的性能取舍，效果依赖具体 GPU 和输入。

问题是线程数改变后，每线程累加哪些元素、BlockReduce 怎样组织 warp 与归约树也随之变化。即使 hidden 长度和数学公式相同，浮点累加顺序仍可能不同。

## eager 固定什么，compile 还要检查什么

按文章分析的 vLLM v0.25.1 路径，开启批次不变模式后，有 residual 的 eager 路径使用 CUDA 融合实现并固定 block 上限；无 residual 路径使用专用 Triton kernel，不做自动调参，固定逻辑 `BLOCK_SIZE=1024`。目的都是让同一行的分段求和结构不随 `num_tokens` 改变。逻辑 BLOCK_SIZE 是每次处理的元素范围，不等于 CUDA 线程数。

编译模式可能走另一条链：CustomOp 被禁用，进入 native PyTorch 实现，再由 TorchDynamo 捕获、Inductor 融合生成 kernel。因此 eager 中固定参数，并不证明编译结果使用了同一内核。

Inductor 的 Split-Reduction 可以把较长 hidden 维交给多个任务，再合并局部和；是否拆分可能取决于批次的形状代表值。文章给出的版本条件中，`hidden_size <= 8192` 通常保持单程归约；更长 hidden 维、较小批次代表值以及不同编译范围，可能让不同图选出不同拆分结构。这个阈值不能作为跨版本规则使用。

## 边界与依据

不同精度、量化方式、residual、融合及编译配置会进入不同实现；第 29–31 页的路径矩阵正是这些分支的对照。第 31 页的批次不变分支还拒绝 `variance_size_override`。固定一个参数不是整条推理链确定性的充分证明，需核对最终执行代码与结果；本项目未运行 GPU 复现实验。

**依据**：来源 source-453368191f4d，PDF 第 26–36 页。
