# Happy GitHub Journey

一个待规划内容的静态站点。目前只有标题和空内容状态；主题范围与内容结构将在后续讨论中确定。

- 网站：[github-journey.anjing.cc](https://github-journey.anjing.cc/)
- 公开仓库：[anjing-le/happy-github-journey](https://github.com/anjing-le/happy-github-journey)

## 本地构建

需要 Node.js 18 或更新版本。无第三方依赖。

```bash
npm run build
```

构建结果位于 `dist/`。站点源文件在 `site/`，构建脚本只将其复制到 `dist/`。

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
| 自定义域名 | `github-journey.anjing.cc` |

自定义域名通过 `github-journey` 的 CNAME 指向 `happy-github-journey.pages.dev`。Cloudflare 中域名状态为 Active，SSL 已启用。

## 初始上线验证

2026-10-01 已确认：

- 本地 `npm run build` 成功，Cloudflare 从 `main` 的 `605fce9` 完成首轮构建和部署。
- 默认域名和自定义域名的 HTTPS 页面、CSS 与本地构建结果逐字节一致。
- Chrome 能打开自定义域名，显示标题和“内容正在规划中。”。
- 本地浏览器在 320px 宽度下无横向溢出；这是浏览器模拟检查，尚未进行手机真机检查。

当前站点使用 HTML 和 CSS，无后端、数据库或运行时 JavaScript。下一阶段再规划学习内容、交互和配套 Skill。
