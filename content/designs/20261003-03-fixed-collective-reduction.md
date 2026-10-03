---
{
  "id": "design-fixed-collective-reduction",
  "title": "固定跨卡的合并路径",
  "status": "draft",
  "summary": "控制跨 GPU 的求和算法与分区，避免通信策略变化重新引入数值波动。",
  "technologies": [
    "tech-floating-point-reduction-order",
    "tech-nccl-allreduce"
  ]
}
---

多卡各自算出稳定的局部结果后，还需要合并。通信算法、通道、数据分区或快路径随消息大小变化时，浮点求和的顺序也可能变化。

因此需要约束实际 collective 路径，并检查框架自定义通信是否绕过这些约束；仅固定一个 Ring/Tree 名称不足以证明整条路径一致。

**取舍**：收窄通信策略可能损失吞吐或拓扑适应能力，具体代价未在本项目测量；环境变量的支持范围和有效值需另行核对。

**依据**：来源 source-453368191f4d，PDF 第 42–47 页。单卡的稳定输出不能替代多卡验证。
