---
{
  "id": "design-execution-path-coverage",
  "title": "按执行路径落实约束",
  "status": "draft",
  "summary": "把约束落实到真正执行的内核，覆盖算子分发和编译后的不同分支。",
  "technologies": ["tech-pytorch-dispatch-inductor"]
}
---

一个算子可能按硬件、精度、输入形状和 eager/compile 模式进入不同实现。确定性约束需要落到真正执行的内核，并覆盖相关分支；入口设置存在，不代表编译融合后仍使用同一实现。

文章展示了 eager 算子覆盖在编译路径中可能被跳过，以及 Inductor 按形状改变归约实现的情况。应结合最终分发、生成代码和结果对照核验，不能把一次内核修复扩大成整条链路的保证。

**依据**：来源 source-453368191f4d，PDF 第 18、22、26、29–36 页，分析绑定文章所述 vLLM v0.25.1 路径。我们尚未复现这些执行分支。
