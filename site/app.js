import { content } from "./content.js"

const levelKeys = Object.keys(content.levels)
const itemIndex = new Map(
  levelKeys.flatMap((level) =>
    content.items[level].map((item) => [`${level}/${item.id}`, item]),
  ),
)

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]
  })

const byId = (id) => document.getElementById(id)
const itemAt = (level, id) => itemIndex.get(`${level}/${id}`)
const refHash = (level, id) => `#knowledge/${level}/${id}`

let dom
let route
let sourceFilter = "all"
let query = ""
let practiceReturn = null

function parseRoute() {
  const parts = window.location.hash.slice(1).split("/").map((part) => {
    try { return decodeURIComponent(part) } catch { return "" }
  })
  if (parts[0] === "practices") {
    const practice = content.practices.find((entry) => entry.id === parts[1]) ?? content.practices[0]
    return {
      section: "practices",
      practiceId: practice?.id,
      view: parts[2] === "ai" ? "ai" : "human",
      detailOpen: false,
    }
  }

  const level = levelKeys.includes(parts[1]) ? parts[1] : "sources"
  const explicitItem = itemAt(level, parts[2]) ? parts[2] : null
  return {
    section: "knowledge",
    level,
    itemId: explicitItem,
    detailOpen: Boolean(explicitItem) && window.history.state?.detailOpen !== false,
  }
}

function applyRoute({ focusDetail = false } = {}) {
  route = parseRoute()
  if (route.section === "practices") practiceReturn = null
  document.body.classList.toggle("detail-open", route.section === "knowledge" && route.detailOpen)
  render()
  syncDetailAccessibility()
  if (focusDetail && route.detailOpen) {
    dom.detailPanel.scrollTop = 0
    dom.detailPanel.focus({ preventScroll: true })
  }
}

function syncDetailAccessibility() {
  const modal = window.matchMedia("(max-width: 760px)").matches &&
    document.body.classList.contains("detail-open")
  if (modal) {
    dom.detailPanel.setAttribute("role", "dialog")
    dom.detailPanel.setAttribute("aria-modal", "true")
  } else {
    dom.detailPanel.removeAttribute("role")
    dom.detailPanel.removeAttribute("aria-modal")
  }
  for (const element of document.querySelectorAll(
    ".site-header, .skip-link, .intro, .preview-note, .learning-path, .section-heading, .library-toolbar, .library-list-column, .site-footer",
  )) element.inert = modal
}

function navigate(hash, { detailOpen = false, replace = false, focusDetail = false } = {}) {
  const method = replace ? "replaceState" : "pushState"
  window.history[method]({ detailOpen }, "", hash)
  applyRoute({ focusDetail })
}

function clearFilters() {
  query = ""
  sourceFilter = "all"
  dom.search.value = ""
}

function render() {
  for (const button of dom.sectionButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.section === route.section))
  }
  for (const panel of dom.panels) {
    panel.hidden = panel.dataset.panel !== route.section
  }
  if (route.section === "knowledge") renderKnowledge()
  else renderPractices()
}

function renderKnowledge() {
  const meta = content.levels[route.level]
  dom.heading.textContent = meta.heading
  dom.description.textContent = meta.description
  dom.search.placeholder = `搜索${meta.label}`

  for (const level of levelKeys) {
    const button = dom.levelButtons.find((entry) => entry.dataset.level === level)
    button?.setAttribute("aria-pressed", String(level === route.level))
    const counter = document.querySelector(`[data-count="${level}"]`)
    if (counter) counter.textContent = String(content.items[level].length)
  }

  const showSourceFilters = route.level === "sources"
  dom.sourceFilters.hidden = !showSourceFilters
  dom.sourceFilters.style.display = showSourceFilters ? "" : "none"
  for (const button of dom.sourceButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.source === sourceFilter))
  }

  const search = query.trim().toLocaleLowerCase("zh-CN")
  const visible = content.items[route.level].filter((item) => {
    if (showSourceFilters && sourceFilter !== "all" && item.kind !== sourceFilter) return false
    if (!search) return true
    return [item.title, item.summary, ...item.tags].join(" ").toLocaleLowerCase("zh-CN").includes(search)
  })
  const selected = visible.find((item) => item.id === route.itemId) ?? visible[0]

  dom.knowledgeList.innerHTML = visible.length
    ? visible.map((item) => renderKnowledgeCard(route.level, item, item.id === selected?.id)).join("")
    : '<div class="empty-state" role="status">没有匹配的结构演示条目。试试其他关键词或类型。</div>'
  dom.detailPanel.innerHTML = selected
    ? renderDetail(route.level, selected)
    : '<div class="empty-state" role="status">当前筛选下没有详情。</div>'

  if (!selected) document.body.classList.remove("detail-open")
}

function renderKnowledgeCard(level, item, selected) {
  const kind = level === "sources" ? content.sourceTypes[item.kind] : content.levels[level].label
  return `
    <button type="button" class="knowledge-card${selected ? " is-selected" : ""}"
      data-item-id="${escapeHtml(item.id)}" aria-current="${selected ? "true" : "false"}">
      <span class="card-kind">${escapeHtml(content.demoLabel)} · ${escapeHtml(kind)}</span>
      <span class="card-title">${escapeHtml(item.title)}</span>
      <span class="card-summary">${escapeHtml(item.summary)}</span>
      <span class="card-tags">${item.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</span>
    </button>`
}

function renderReferences(references) {
  return `<div class="reference-list">${references
    .map((reference) => {
      const target = itemAt(reference.level, reference.id)
      if (!target) return ""
      return `<button type="button" class="cross-reference"
        data-ref-level="${escapeHtml(reference.level)}" data-ref-id="${escapeHtml(reference.id)}">
        <span class="reference-level">${escapeHtml(content.levels[reference.level].label)}</span>
        <span>${escapeHtml(target.title)}</span>
      </button>`
    })
    .join("")}</div>`
}

function renderDetail(level, item) {
  const kind = level === "sources" ? content.sourceTypes[item.kind] : content.levels[level].label
  return `
    <p class="detail-eyebrow">${escapeHtml(content.demoLabel)} / ${escapeHtml(kind)}</p>
    <h3 class="detail-title">${escapeHtml(item.title)}</h3>
    <p class="detail-summary">${escapeHtml(item.summary)}</p>
    ${item.blocks.map((block) => `<section class="detail-block"><h3>${escapeHtml(block.title)}</h3><p>${escapeHtml(block.text)}</p></section>`).join("")}
    <section class="detail-block"><h3>关联条目</h3>${renderReferences(item.references)}</section>
    <p class="source-note">${escapeHtml(content.demoNotice)} 验证状态：待验证。</p>
    <button type="button" data-close-detail${practiceReturn ? ' data-return-practice' : ''}>${practiceReturn ? '返回实践文章' : '返回列表'}</button>`
}

function renderPractices() {
  const practice = content.practices.find((entry) => entry.id === route.practiceId) ?? content.practices[0]
  if (!practice) {
    dom.practiceList.innerHTML = '<div class="empty-state">暂无结构演示文章。</div>'
    dom.practiceArticle.innerHTML = '<div class="empty-state">暂无文章详情。</div>'
    return
  }

  dom.practiceList.innerHTML = content.practices
    .map((entry) => `<button type="button" class="practice-card${entry.id === practice.id ? " is-selected" : ""}"
      data-practice-id="${escapeHtml(entry.id)}" aria-current="${entry.id === practice.id ? "true" : "false"}">
      <strong>${escapeHtml(entry.title)}</strong>
      <span class="practice-status">${escapeHtml(entry.status)}</span>
    </button>`)
    .join("")

  const aiMarkdown = buildAiMarkdown(practice)
  dom.practiceArticle.innerHTML = `
    <header class="article-header">
      <span class="practice-status">${escapeHtml(practice.status)}</span>
      <h3 class="article-title">${escapeHtml(practice.title)}</h3>
      <p class="article-intro">${escapeHtml(practice.intro)}</p>
      <div class="view-switch" role="group" aria-label="文章视图">
        <button type="button" data-view="human" aria-pressed="${route.view === "human"}">精简版</button>
        <button type="button" data-view="ai" aria-pressed="${route.view === "ai"}">AI 详细版</button>
      </div>
    </header>
    ${route.view === "ai" ? renderAiView(practice, aiMarkdown) : renderHumanView(practice)}
  `
}

function renderHumanView(practice) {
  return `
    <section class="article-section">
      <p class="section-label">01 / 场景与目标</p>
      <h3>先确认要解决的问题</h3>
      <p class="article-copy">${escapeHtml(practice.scenario)} ${escapeHtml(practice.goal)}</p>
    </section>
    <section class="article-section">
      <p class="section-label">02 / 建议做法</p>
      <h3>保留来路，再形成判断</h3>
      <p class="article-copy">${escapeHtml(practice.approach)}</p>
    </section>
    <section class="article-section">
      <p class="section-label">03 / 证据与边界</p>
      <h3>这些示例仍待验证</h3>
      <p class="article-copy">${escapeHtml(practice.boundary)}</p>
      ${renderReferences(practice.references)}
      <p class="source-note">以上引用均为虚构的本地 demo ID，没有外部来源或真实验证记录。</p>
    </section>`
}

function buildAiMarkdown(practice) {
  const bullets = (values) => values.map((value) => `- ${value}`).join("\n")
  const references = practice.references.map((reference) => {
    const url = new URL(refHash(reference.level, reference.id), window.location.href).href
    return `- [${itemAt(reference.level, reference.id)?.title ?? reference.id}](${url}) — ${content.levels[reference.level].label}（虚构演示）`
  }).join("\n")
  return `# ${practice.title}\n\n> ${practice.status}。${content.demoNotice}\n\n## 场景与目标\n${practice.scenario}\n\n目标：${practice.goal}\n\n## 场景约束\n${bullets(practice.constraints)}\n\n## 建议做法\n${practice.approach}\n\n## 取舍\n${bullets(practice.tradeoffs)}\n\n## 建议步骤\n${bullets(practice.steps)}\n\n## 验证与边界\n${bullets(practice.verification)}\n\n${practice.boundary}\n\n## 来源（结构演示）\n${references}`
}

function renderAiView(practice, markdown) {
  return `
    <section class="article-section">
      <p class="section-label">结构化 Markdown / 同一条实践数据</p>
      <div class="ai-toolbar">
        <p class="article-copy">可复制这份演示文档；真实来源和验证状态仍需以后补充。</p>
        <button type="button" class="copy-button" data-copy-markdown>复制 Markdown</button>
      </div>
      <p class="copy-status" role="status" aria-live="polite"></p>
      <pre class="ai-document">${escapeHtml(markdown)}</pre>
    </section>
    <section class="article-section">
      <p class="section-label">引用跳转</p>
      <h3>回到演示条目</h3>
      ${renderReferences(practice.references)}
      <p class="source-note">文档和页面引用均指向同一组演示条目，正式来源将在后续学习中补充。</p>
    </section>`
}

async function copyMarkdown() {
  const practice = content.practices.find((entry) => entry.id === route.practiceId)
  const status = dom.practiceArticle.querySelector(".copy-status")
  if (!practice || !status) return
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable")
    await navigator.clipboard.writeText(buildAiMarkdown(practice))
    status.textContent = "已复制 Markdown。"
  } catch {
    status.textContent = "复制失败，请手动选择并复制下方内容。"
  }
}

function onClick(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement
  if (!target) return

  const sectionButton = target.closest("button[data-section]")
  if (sectionButton) {
    practiceReturn = null
    const section = sectionButton.dataset.section
    if (section === "knowledge") {
      clearFilters()
      navigate(`#knowledge/${route.level ?? "sources"}`)
    } else if (section === "practices") {
      navigate(`#practices/${content.practices[0]?.id ?? ""}/human`)
    }
    return
  }

  const levelButton = target.closest("button[data-level]")
  if (levelButton && levelKeys.includes(levelButton.dataset.level)) {
    clearFilters()
    navigate(`#knowledge/${levelButton.dataset.level}`)
    return
  }

  const filterButton = target.closest("button[data-source]")
  if (filterButton && content.sourceTypes[filterButton.dataset.source]) {
    sourceFilter = filterButton.dataset.source
    document.body.classList.remove("detail-open")
    navigate(`#knowledge/${route.level}`, { replace: true })
    return
  }

  const reference = target.closest("[data-ref-level][data-ref-id], a[href^='#knowledge/']")
  if (reference) {
    const hash = reference.matches("a") ? reference.getAttribute("href") : refHash(reference.dataset.refLevel, reference.dataset.refId)
    const [, level, id] = hash?.split("/") ?? []
    if (itemAt(level, id)) {
      event.preventDefault()
      if (route.section === "practices") {
        practiceReturn = { hash: window.location.hash, scroll: window.scrollY }
      }
      clearFilters()
      navigate(hash, { detailOpen: true, focusDetail: true })
    }
    return
  }

  const card = target.closest("button[data-item-id]")
  if (card && route.section === "knowledge" && itemAt(route.level, card.dataset.itemId)) {
    navigate(refHash(route.level, card.dataset.itemId), { detailOpen: true, focusDetail: true })
    return
  }

  if (target.closest("button[data-close-detail]")) {
    document.body.classList.remove("detail-open")
    if (practiceReturn) {
      const destination = practiceReturn
      practiceReturn = null
      navigate(destination.hash)
      dom.practiceArticle.focus({ preventScroll: true })
      window.scrollTo(0, destination.scroll)
      return
    }
    navigate(`#knowledge/${route.level}`, { replace: true })
    dom.knowledgeList.querySelector('[aria-current="true"]')?.focus({ preventScroll: true })
    return
  }

  const practiceCard = target.closest("button[data-practice-id]")
  if (practiceCard) {
    navigate(`#practices/${practiceCard.dataset.practiceId}/human`)
    return
  }

  const viewButton = target.closest("button[data-view]")
  if (viewButton && route.section === "practices") {
    navigate(`#practices/${route.practiceId}/${viewButton.dataset.view}`)
    return
  }

  if (target.closest("button[data-copy-markdown]")) void copyMarkdown()
}

function init() {
  dom = {
    sectionButtons: [...document.querySelectorAll("button[data-section]")],
    panels: [...document.querySelectorAll("section[data-panel]")],
    levelButtons: [...document.querySelectorAll("button[data-level]")],
    sourceButtons: [...document.querySelectorAll("button[data-source]")],
    sourceFilters: byId("source-filters"),
    heading: byId("knowledge-heading"),
    description: byId("knowledge-description"),
    search: byId("search-input"),
    knowledgeList: byId("knowledge-list"),
    detailPanel: byId("detail-panel"),
    practiceList: byId("practice-list"),
    practiceArticle: byId("practice-article"),
  }
  const required = ["sourceFilters", "heading", "description", "search", "knowledgeList", "detailPanel", "practiceList", "practiceArticle"]
  if (required.some((key) => !dom[key])) {
    console.error("Happy GitHub Journey: page shell is missing a required prototype element.")
    return
  }
  document.addEventListener("click", onClick)
  document.addEventListener("keydown", (event) => {
    if (dom.detailPanel.getAttribute("aria-modal") !== "true") return
    if (event.key === "Escape") {
      dom.detailPanel.querySelector("[data-close-detail]")?.click()
      return
    }
    if (event.key !== "Tab") return
    const buttons = [...dom.detailPanel.querySelectorAll("button, a[href]")]
    const first = buttons[0]
    const last = buttons.at(-1)
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dom.detailPanel)) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dom.detailPanel)) {
      event.preventDefault()
      first?.focus()
    }
  })
  window.matchMedia("(max-width: 760px)").addEventListener("change", syncDetailAccessibility)
  dom.search.addEventListener("input", () => {
    query = dom.search.value
    document.body.classList.remove("detail-open")
    navigate(`#knowledge/${route.level}`, { replace: true })
  })
  window.addEventListener("popstate", () => {
    clearFilters()
    applyRoute()
  })
  window.addEventListener("hashchange", () => {
    clearFilters()
    applyRoute()
  })
  applyRoute()
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true })
else init()
