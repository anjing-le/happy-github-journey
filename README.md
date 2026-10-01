# Happy GitHub Journey

一个用于后续设计和迭代的静态学习站。当前仅提供三层空白块的交互骨架，不填写内容。正式内容、分类和配套 Skill 仍在规划中。

- 网站：[happy-github.anjing.cc](https://happy-github.anjing.cc/)
- 公开仓库：[anjing-le/happy-github-journey](https://github.com/anjing-le/happy-github-journey)
- 之前的结构预览保存在 Git 历史中。

## 本地构建

需要 Node.js 18 或更新版本。无第三方依赖。

```bash
npm run build
```

站点源码在 `site/`。构建脚本清理 `dist/` 后复制源码。界面使用原生 HTML、CSS 和 JavaScript，无第三方运行时依赖。

## 当前交互

- 每层五个空白块，只有内部演示关联，无项目名称、文章或知识内容。
- 选中一个块后，相邻层的直接关联块稳定置顶；点击打开空白浮窗，关闭后保留选择。
- 拖动右侧拖柄可调整本列任意位置；再次选择时重新按关联置顶。排序仅存在当前页面内，刷新后重置。
- 键盘方向键在同列移动焦点，`Alt + ↑/↓` 调整顺序，`Escape` 关闭浮窗或取消拖拽。
- 窄屏支持横向滑动和 `01 / 02 / 03` 切列，拖柄采用 Pointer Events。

2026-10-01 已在浏览器核对关联置顶、浮窗关闭、拖拽落位、键盘排序和窄屏切列。320px、390px 和桌面尺寸未发现页面横向溢出。拖动检查采用浏览器指针操作，手机触摸体验尚未进行真机验证。

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
