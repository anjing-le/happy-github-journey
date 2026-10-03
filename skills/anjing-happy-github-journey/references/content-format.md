# 内容格式

`content/` 中的 Markdown 是唯一内容来源；`dist/catalog.js` 和 `dist/catalog.json` 由构建生成，不能手改。每个条目一个 Markdown 文件，文件平铺在 `sources/`、`designs/` 或 `technologies/` 下。新目录在有实际条目时创建。

文件以 `---` 包住一个 JSON 对象作为前置信息（合法 YAML flow mapping），后面是 Markdown 正文。JSON 确保零依赖构建可以可靠读取。共同字段为稳定的 `id`、`title`、`status`，可选 `summary` 为简述，可选 `preview` 为悬停要素。ID 全库唯一，重命名标题时保留 ID；文件名按收录顺序排序。

`preview` 是由 `{ "label": "...", "text": "..." }` 组成的数组，标签和内容为自然简短的非空字符串。第一层用“背景、用途”，第二层用“方法、用途”，第三层用“是什么、用途”。例如已解析文章可以填写：

```json
{
  "preview": [
    { "label": "背景", "text": "相同输入在不同组批下可能得到不同结果。" },
    { "label": "用途", "text": "理解如何保持推理结果可复现。" }
  ]
}
```

仅收藏链接时，未知的背景与用途不猜填。摘要、悬停和详情各自承担快速识别、要素概览和知识解释，不需要重复整段内容。

## 第一层：sources

收录时只填写已知信息：

```markdown
---
{
  "id": "source-stable-id",
  "title": "核实后的标题，或注明暂定的收录标签",
  "type": "article",
  "url": "https://example.com/article",
  "status": "pending",
  "receivedAt": "2026-10-02",
  "designs": [],
  "archive": { "status": "pending" }
}
---

用户备注、收录范围和访问限制。链接收录不是已取得正文或已解析。
```

`type` 初始为 `article` 或 `open-source`，允许其他非空字符串。`status` 为 `pending`、`draft` 或 `reviewed`；待解析条目的 `designs` 必须为空。只有第一层填写外部 `url`。

解析后的第一层正文用自己的话复述吸收后的内容，精简通俗地讲清背景、用途、问题与目标、主要思路、必要例子和取舍。关键因果关系不能因拆到下层而丢失，第一层仍可独立读懂。按理解重新组织，不复刻原件各章节摘要，也不采用“原文、作者、PDF 页码、引用”式叙述。原始链接由 `url` 交给第一层来源按钮展示。

取得实际原件后，`archive` 可改为：

```json
{
  "status": "saved",
  "file": ".pocket/source-stable-id/original.pdf",
  "capturedAt": "2026-10-02",
  "completeness": "unknown"
}
```

文件必须真实存在且非空，位于仓库 `.pocket/` 内；新增或修改原件后运行 `npm run verify:archives` 验证本地存档。`completeness` 为 `unknown`（待核对）、`partial`（有缺失）或 `checked`（完整正文和图片已经实际核对）。公开构建仅验证存档记录的格式，只发布状态、日期和完整性，移除私有文件路径；不会要求私有 PDF 存在于 Cloudflare checkout。原件本身不进入网站或公开 Git，本地保存不等于异地备份，长期备份位置另按用户要求配置。

完整性核对针对实际保存的版本。例如逐页核对上传 PDF 的正文、静态图示与结尾，可以记录为 `checked`；它不自动证明与在线版一致，也不覆盖 PDF 外的动图、视频或外链。实际范围、缺失项及核对依据记录在 `.pocket/<source-id>/evidence.md`，不写成公开详情的存档报告。

## 第二、三层：designs / technologies

解析时才创建，不预填占位内容：

```json
{
  "id": "design-stable-id",
  "title": "可组合、可迁移的设计动作",
  "status": "draft",
  "summary": "采取什么方法，以及它解决什么问题。",
  "preview": [
    { "label": "方法", "text": "具体采取的安排。" },
    { "label": "用途", "text": "它怎样支撑场景目标。" }
  ],
  "technologies": ["tech-stable-id"]
}
```

第二层正文说明方法怎样发挥作用、如何与其他设计组合，以及必要条件与取舍。未经验证不泛称最佳实践。

```json
{
  "id": "tech-stable-id",
  "title": "单个基础概念名称",
  "status": "draft",
  "summary": "这个概念是什么，以及它有什么用。",
  "preview": [
    { "label": "是什么", "text": "概念的通俗解释。" },
    { "label": "用途", "text": "它能用于解决什么问题。" }
  ]
}
```

第三层一张卡解释一个独立有意义的基础概念；HTML 与 CSS 等不同概念分卡，不把多种机制或一条技术链路打包成卡。正文按理解需要补充原理，不无限递归无关依赖。二、三层不填写独立外部 URL。

关联只维护两处：第一层 `designs` 引用第二层 ID，第二层 `technologies` 引用第三层 ID。反向的 `sources`、`designs` 由构建生成，勿手写；共享条目允许被多个来源或设计引用。设计必须有来源，技术必须被设计引用，不能出现悬空 ID 或同名不同义的随意合并。

## 内部证据笔记

`.pocket/<source-id>/evidence.md` 保存使用版本与原件核对范围，并按关联条目 ID 记录证据位置（章节、PDF 页码或源码路径）、推断和未验证项。公开 frontmatter 不增加证据文本或私有笔记路径，正文与 `preview` 也不嵌入这些记录；它们不进入 catalog、详情或复制内容。

重要适用条件直接融入知识解释，不写成审计说明或阅读指南。不确定主张不能提升为事实；不足以支持本条时保留待解析。初稿为 `draft`，仅用户明确认可本条后改为 `reviewed`，认可 Skill 不等于认可其每条输出。

写完运行 `npm run build`；检查待解析条目没有被误标完成，生成目录没有原件、私有路径或虚构关联。构建自动为样式、脚本及内容依赖生成内容哈希版本，按 `AGENTS.md` 核对提交身份后再提交。
