# 微信图文获取与存档

目标是取得可离线阅读的正文和图片，再进行三层拆解。图片链接清单、阅读服务生成的文字以及验证码页，均不能替代完整图文原件。

## 首选：自动获取公开页面

使用本 Skill 的 `scripts/capture_wechat.py`。捕获工具使用 Python 3.10+；网站仍无第三方运行时依赖。运行前检查 `requests`、`beautifulsoup4` 和 `Pillow` 是否可用；依赖缺失或版本不兼容时使用隔离环境，不修改全局 Python：

```bash
python3 -m venv .pocket/capture-env
.pocket/capture-env/bin/python -m pip install \
  -r skills/anjing-happy-github-journey/scripts/requirements-capture.txt
```

使用隔离环境时，把后续命令的 `python3` 替换为 `.pocket/capture-env/bin/python`。

```bash
python3 skills/anjing-happy-github-journey/scripts/capture_wechat.py \
  --url 'https://mp.weixin.qq.com/s/文章标识' \
  --output '.pocket/source-id/capture-YYYYMMDD-HHMMSS'
```

每次使用新的捕获目录，保留上次成功的原件。脚本不读取现有浏览器的 cookies、登录数据或配置，不自动修改素材 Markdown。先检查实际退出码和 `capture.json` 或 `attempt.json`，再决定是否更新条目。

- 页面必须有真实的 `#js_content`、标题以及正文文字或图片；不能找不到正文就回退到整个页面。
- 保存输入 HTML、离线阅读 HTML、阅读用 Markdown、图片文件和捕获清单。阅读文件是派生件，输入 HTML 保留作原件。
- 派生阅读文件保留正文与图片顺序，不保证还原全部排版。普通“HTML＋资源目录”导入保留输入 HTML 与抽取后的图片，原件的旧资源路径不原样复制；`capture.json` 记录该限制，离线阅读用 `reading.html`。需要独立、忠实的单文件原件时优先用 SingleFile。
- 检查图片预计数、实际成功数、失败原因及文件校验；下载失败不能用透明图片补位。动画、音视频、嵌入内容与背景图的限制应记录。
- 脚本成功仅表示已保存当前页面能取得的内容，完整性先为 `unknown`；有缺失则为 `partial`。核对尾部、图示与限制后才能由 Codex 标为 `checked`，不能单凭成功退出自动认可完整性。

## 验证页后的后备：导入正常打开的页面

普通公开请求被微信验证拦住时，停止同一种无效重试。先检查用户正常浏览器是否能打开完整文章；如果工具仍无法操作该浏览器，清楚说明需要的一次导出，不反复让用户重装或提供连续截图。

可用已有浏览器的“另存为网页（全部）”，同时保留 HTML 和配套资源目录。若用户已有 [SingleFile](https://github.com/gildas-lormeau/SingleFile)，优先保存包含图片的单个 HTML；它也支持保存选中的多个标签。安装新扩展及新增网站访问权限需要按当前会话规则确认，不自动安装或授予所有网站权限。原件本地保存，不启用扩展的云上传。

```bash
python3 skills/anjing-happy-github-journey/scripts/capture_wechat.py \
  --url 'https://mp.weixin.qq.com/s/文章标识' \
  --html '/实际路径/已保存文章.html' \
  --output '.pocket/source-id/capture-YYYYMMDD-HHMMSS'
```

导入后仍检查正文、图片和缺失项。保存失败的页面、未加载的图片或已下架文章不会因导入而变完整。遇到需要验证的访问，按照正常验证流程交接；若工具明确拒绝访问该网站，不能换脚本或其他控制接口绕过工具拒绝。

## 更新素材

取得原件后才修改第一层的 `archive`，指向实际输入原件并记录真实日期；运行 `npm run verify:archives`。捕获成功不自动变更解析状态，内容仍为 `pending`，完成有依据的拆解后才变为 `draft`。

读取 `article.md` 与关键图片，保留图示证据位置；有缺失时先判断是否影响拟提炼的设计，影响则补齐后解析。首次样例仍逐条校准，批量获取原件不等于批量解析已获授权。

## 已验证的限制

2026-10-02，这批 14 条分享链接的普通公开请求都返回微信环境验证页；第一篇 `YRwGxVsO93M0-2bupN-bqQ` 的 Jina Reader 匿名读取也返回验证页，未取得正文或图片；当时 Chrome 控制指令也超时。这是一次具体环境的失败记录，不是所有微信文章永久不可访问的结论。不能宣称换个 User-Agent、阅读服务或新脚本就能免验证取到所有文章。
