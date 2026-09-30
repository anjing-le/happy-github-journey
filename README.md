# Happy GitHub Journey

一个待规划内容的静态站点。目前只有标题和空内容状态；主题范围与内容结构将在后续讨论中确定。

## 本地构建

需要 Node.js 18 或更新版本。无第三方依赖。

```bash
npm run build
```

构建结果位于 `dist/`。站点源文件在 `site/`，构建脚本只将其复制到 `dist/`。

## Cloudflare Pages

GitHub 仓库已创建；计划通过 Cloudflare Pages 的 Git 集成发布：

| 设置 | 值 |
| --- | --- |
| GitHub 仓库 | `anjing-le/happy-github-journey` |
| 生产分支 | `main` |
| 框架预设 | None |
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| 计划域名 | `github-journey.anjing.cc` |

Cloudflare 项目连接、域名绑定和线上验证状态需要在实际完成后记录；此文档不把计划当作上线结果。
