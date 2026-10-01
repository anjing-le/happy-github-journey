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
- 三层标题为“项目与文章、关键设计、技术与原理”，层级标题及块标题居中。点击第一层块的空白区域后，右侧仅显示关联设计及其技术并集，并染色；点击第二层块的空白区域进一步筛选第三层，保留第一层选择。第三层选择只标记自身。
- 再次点击已选块取消选择；切换或取消上游选择会清除下游选择。筛选保留固定顺序，不排序、不拖拽；选择只存在当前页面内，刷新后重置。关联为空时显示空列。
- 块右侧不放图标；点击块标题独立打开详情，不改变筛选。关闭后保留筛选并返回标题按钮焦点。键盘方向键在当前可见块之间移动焦点，`Escape` 关闭浮窗。
- 窄屏支持横向滑动和标题切列。
- 三层分别使用蓝色、紫色和青绿色，标题、块、窄屏切列按钮与详情浮窗对应；关联和选中状态以同色加深强调。
- 大阅读浮窗在桌面占大部分页面，在手机上接近全屏；支持关闭按钮、Escape 和遮罩关闭，正文区域独立滚动。
- 只有第一层“项目与文章”提供外部来源引用。来源 URL 预留在 `site/content.js` 中，配置真实 HTTP/HTTPS 来源时才显示详情里的“来源”入口；当前全部为空。第二、三层没有独立来源入口，通过层间关联追溯。后续正式项目和文章必须保留出处。

2026-10-01 已在浏览器核对逐层关联筛选、染色、切换与取消选择、详情入口独立及关闭后的焦点恢复。桌面与 320px 窄屏未发现页面横向溢出；窄屏切列及大详情浮窗已检查，手机触摸体验尚未进行真机验证。

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
