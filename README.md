# Happy GitHub Journey

一个用于后续设计和迭代的静态学习站。根据用户反馈，当前页面内容和 UI 已清空，页面保持空白。正式内容、分类和配套 Skill 仍在规划中。

- 网站：[happy-github.anjing.cc](https://happy-github.anjing.cc/)
- 公开仓库：[anjing-le/happy-github-journey](https://github.com/anjing-le/happy-github-journey)
- 之前的结构预览保存在 Git 历史中。

## 本地构建

需要 Node.js 18 或更新版本。无第三方依赖。

```bash
npm run build
```

站点源码在 `site/`。构建脚本清理 `dist/` 后复制源码；当前只发布空白 HTML，不加载样式或运行时脚本。

## Cloudflare Pages

推送到 `main` 后，由 Cloudflare Pages 的 Git 集成自动部署。

| 设置 | 值 |
| --- | --- |
| GitHub 仓库 | `anjing-le/happy-github-journey` |
| Pages 项目 | `happy-github-journey` |
| 生产分支 | `main` |
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| 默认域名 | `happy-github-journey.pages.dev` |
| 自定义域名 | `happy-github.anjing.cc` |
| 保留域名 | `github-journey.anjing.cc` |
