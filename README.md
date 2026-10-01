# Happy GitHub Journey

一个用于讨论和迭代的静态学习站。当前是可交互的结构预览，正式内容、分类和维护流程仍在规划中。

- 网站：[happy-github.anjing.cc](https://happy-github.anjing.cc/)
- 公开仓库：[anjing-le/happy-github-journey](https://github.com/anjing-le/happy-github-journey)

## 本地构建

需要 Node.js 18 或更新版本。无第三方依赖。

```bash
npm run build
```

构建结果位于 `dist/`。站点源文件在 `site/`，构建脚本只将其复制到 `dist/`。

## 当前预览

- 知识积累：学习条目、关键设计、技术与原理三层，可搜索、按来源筛选并沿引用跳转。
- 最佳实践：围绕场景和目标组织；精简版与 AI 详细版共用 `site/content.js` 中的内容。
- `site/app.js` 提供原生浏览器交互，无第三方运行时依赖。仍是纯前端静态站，无后端或数据库。
- 所有示例均标记为虚构的结构演示。示例计数表示页面演示数据，引用指向演示条目，实践状态为待验证；不代表已完成的真实项目研究。
- 此版本用于获得视觉指引，允许继续修改信息结构；配套 Skill 和正式内容录入流程尚未实现。

## Cloudflare Pages

已通过 Cloudflare Pages 的 Git 集成发布。推送到 `main` 会自动构建并更新正式站点：

| 设置 | 值 |
| --- | --- |
| GitHub 仓库 | `anjing-le/happy-github-journey` |
| Pages 项目 | `happy-github-journey` |
| 生产分支 | `main` |
| 框架预设 | None |
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| 默认域名 | `happy-github-journey.pages.dev` |
| 自定义域名 | `happy-github.anjing.cc` |
| 保留域名 | `github-journey.anjing.cc` |

两个子域名分别通过 CNAME 指向 `happy-github-journey.pages.dev`。2026-10-01 在 Chrome 的 Cloudflare 控制台确认两者状态为 Active，SSL 已启用。

## 初始上线验证

2026-10-01 已确认：

- 本地 `npm run build` 成功，Cloudflare 从 `main` 的 `605fce9` 完成首轮构建和部署。
- 默认域名和自定义域名的 HTTPS 页面、CSS 与本地构建结果逐字节一致。
- Chrome 能打开自定义域名，显示标题和“内容正在规划中。”。
- 本地浏览器在 320px 宽度下无横向溢出；这是浏览器模拟检查，尚未进行手机真机检查。

以上记录对应最初的空白版本。当前结构预览增加原生 JavaScript 交互。

## 结构预览的本地检查

2026-10-01 已确认：

- `npm run build` 和 JavaScript 语法检查通过。
- 浏览器模拟 320px、390px 和 1280px 宽度未发现横向溢出。
- 来源筛选、搜索空态、三层引用定位和移动端详情返回正常。
- 实践精简版包含场景与目标、建议做法、证据与边界三部分；AI 详细版可复制 Markdown。
- 从实践查看引用后，可返回原文章和阅读版本。以上是浏览器模拟检查，尚未进行手机真机验证。
