# 内容格式

`content/` 中的 Markdown 是唯一内容来源；`dist/catalog.js` 和 `dist/catalog.json` 由构建生成，不能手改。每个条目一个 Markdown 文件，文件平铺在 `sources/`、`designs/` 或 `technologies/` 下。新目录在有实际条目时创建。

文件以 `---` 包住一个 JSON 对象作为前置信息（合法 YAML flow mapping），后面是 Markdown 正文。JSON 确保零依赖构建可以可靠读取。共同字段为稳定的 `id`、`title`、`status`，可选 `summary` 为给人看的简述。ID 全库唯一，重命名标题时保留 ID；文件名按收录顺序排序。

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

取得实际原件后，`archive` 可改为：

```json
{
  "status": "saved",
  "file": ".pocket/source-stable-id/original.pdf",
  "capturedAt": "2026-10-02",
  "completeness": "unknown"
}
```

文件必须真实存在且非空，位于仓库 `.pocket/` 内；新增或修改原件后运行 `npm run verify:archives` 验证本地存档。`completeness` 为 `unknown`（待核对）、`partial`（有缺失）或 `checked`（完整正文和图片已经实际核对）。缺失项和核对依据写在正文。公开构建仅验证存档记录的格式，只发布状态、日期和完整性，移除私有文件路径；不会要求私有 PDF 存在于 Cloudflare checkout。原件本身不进入网站或公开 Git，本地保存不等于异地备份，长期备份位置另按用户要求配置。

完整性核对针对实际保存的版本。例如逐页核对上传 PDF 的正文、静态图示与结尾，可以记录为 `checked`，但须在第一层说明范围；它不自动证明与在线版一致，也不覆盖 PDF 外的动图、视频或外链。

## 第二、三层：designs / technologies

解析时才创建，不预填占位内容：

```json
{ "id": "design-stable-id", "title": "可复用的设计思路", "status": "draft", "summary": "设计动作及其理由。", "technologies": ["tech-stable-id"] }
```

```json
{ "id": "tech-stable-id", "title": "技术或机制名称", "status": "draft", "summary": "关键机制怎样支撑设计。" }
```

正文承载必要的机制、取舍、边界、证据位置和明确标记的推断，不要求固定章节或固定条数。来源 ID、章节、源码路径和 PDF 页码用于追溯；二、三层不填写独立外部 URL。

关联只维护两处：第一层 `designs` 引用第二层 ID，第二层 `technologies` 引用第三层 ID。反向的 `sources`、`designs` 由构建生成，勿手写；共享条目允许被多个来源或设计引用。设计必须有来源，技术必须被设计引用，不能出现悬空 ID 或同名不同义的随意合并。

写完运行 `npm run build`；检查待解析条目没有被误标完成，生成目录没有原件、私有路径或虚构关联。构建自动为样式、脚本及内容依赖生成内容哈希版本，按 `AGENTS.md` 核对提交身份后再提交。
