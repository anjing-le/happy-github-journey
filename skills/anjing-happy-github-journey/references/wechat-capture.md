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

## 原链接不可读：自动寻找可核实的公开版本

停止同一种无效请求，优先检索原始分享 URL 或标识，寻找原作者同步发布或公开转载；搜索引擎漏索引时，可补充目标站正常公开的站内检索。只得到摘要、搜索片段或他人笔记时不能当作完整图文；转载正文必须明确包含原始链接，并检查正文收尾与图示。正常公开副本是独立的材料来源，不通过代理、验证码绕过或换控制接口访问被工具拒绝的网站。

目前脚本支持已验证的 AI 星球文章页。`--url` 保留用户给的微信出处，`--mirror-url` 指向实际读取的转载；两者必须在正文中对应，否则失败：

```bash
python3 skills/anjing-happy-github-journey/scripts/capture_wechat.py \
  --url 'https://mp.weixin.qq.com/s/fVqp5E-UJ9-b7kgAcvekCw' \
  --mirror-url 'https://www.aixq.cc/63314.html' \
  --output '.pocket/source-id/capture-reprint-YYYYMMDD-HHMMSS'
```

保存实际转载 HTML、正文、全部可取得的正文图片和清单。默认占位图不能算保存成功；图片取真实 `data-src`。清单记录 `public-reprint` 和实际读取地址，未与微信原页对照时完整性不标为 `checked`。在第一层展示取得版本和差异限制；第二、三层只提炼有证据的部分。

适配新站点前先检查具体正文容器、真实图片字段与出处证据，不宽泛回退到整页，也不把一个站点的提取规则当成所有站点的规则。

## 已有网页原件：导入正常打开的页面

已有正常取得的网页原件可以导入。浏览器可操作且网站允许时，由 Codex 完成保存；连接失败先排查工具，不反复让用户重装或把人工导出作为默认步骤。无法取得的条目保持待存档，并如实记录缺失。

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

同日，公开检索与站内检索找到第 2、4、5、6、10、13、14 篇对应转载。脚本已实际保存 7 份正文与 117 处正文图片资源，原 HTML 和所有图片的字节、SHA256 已核对；第 2 篇两图已实际查看，并形成待校准的三层初稿。第 14 篇首次保存缺一张超时图片，保留该次记录，在新目录重取后已保存 21/21 张。剩余 7 条未取得可核实的完整图文；搜索无结果不等于原文下架。所有转载仍标记未与微信原页比对，不能把脚本成功直接视为原文完整性证明。
