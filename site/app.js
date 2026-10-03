import { createBoardState } from './board-state.js';
import { catalog, itemFor, sourceUrlFor } from './content.js';

const state = createBoardState(catalog);
const columns = [...document.querySelectorAll('.column')];
const board = document.querySelector('.board');
const detail = document.querySelector('.detail');
const switches = [...document.querySelectorAll('[data-jump]')];
const status = document.querySelector('#status');
const closeButton = document.querySelector('.close-detail');
const sourceLink = document.querySelector('.source-link');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const mobileLayout = matchMedia('(max-width: 720px)');
const hoverPreview = matchMedia('(hover: hover) and (pointer: fine)');
const selectionPath = document.querySelector('.selection-path');
let previewTarget = null;
let viewSnapshot = state.snapshot();
let pathSelection = '';
let detailTarget = null;
let activeLevel = 0;
let boardWidth = board.clientWidth;

const statusLabels = { pending: '待解析', draft: '待校准', reviewed: '已认可' };
const typeLabels = { article: '文章', 'open-source': '开源项目' };

function statusLabel(item) {
  return statusLabels[item.status] ?? item.status ?? '';
}

function archiveLabels(item) {
  if (!item.archive) return [];
  if (item.archive.status === 'pending') return ['待存档'];
  if (item.archive.status !== 'saved') return [];
  const completenessLabels = {
    partial: '存档不完整',
    unknown: '存档完整性待核对',
    checked: '存档已核对',
  };
  return ['存档已保存', completenessLabels[item.archive.completeness] ?? completenessLabels.unknown];
}

// Create text nodes and a small set of inline elements; never execute saved HTML.
function renderInline(node, text) {
  const tokens = /\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|`([^`\n]+)`/g;
  let cursor = 0;
  for (const match of text.matchAll(tokens)) {
    node.append(document.createTextNode(text.slice(cursor, match.index)));
    let inline = null;
    if (match[1]) {
      inline = document.createElement('strong');
      inline.textContent = match[1];
    } else if (match[4]) {
      inline = document.createElement('code');
      inline.textContent = match[4];
    } else {
      try {
        const url = new URL(match[3]);
        if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) {
          inline = document.createElement('a');
          inline.textContent = match[2];
          inline.href = url.href;
          inline.target = '_blank';
          inline.rel = 'noopener noreferrer';
        }
      } catch { /* Invalid links remain visible as text. */ }
    }
    node.append(inline ?? document.createTextNode(match[0]));
    cursor = match.index + match[0].length;
  }
  node.append(document.createTextNode(text.slice(cursor)));
}

function renderBody(container, value) {
  container.replaceChildren();
  const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n');
  let paragraph = [];
  let list = null;
  let code = null;
  const append = (tag, text) => {
    const node = document.createElement(tag);
    renderInline(node, text);
    container.append(node);
    return node;
  };
  const flushParagraph = () => {
    if (paragraph.length) append('p', paragraph.join('\n'));
    paragraph = [];
  };
  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      flushParagraph();
      list = null;
      if (code) code = null;
      else code = append('pre', '').appendChild(document.createElement('code'));
      continue;
    }
    if (code) {
      code.textContent += `${line}\n`;
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      list = null;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      list = null;
      append(`h${Math.min(heading[1].length + 2, 6)}`, heading[2]);
      continue;
    }
    const bullet = line.match(/^\s*(?:[-*+]\s+|\d+[.)]\s+)(.+)$/);
    if (bullet) {
      flushParagraph();
      const tag = /^\s*\d/.test(line) ? 'ol' : 'ul';
      if (!list || list.tagName.toLowerCase() !== tag) list = append(tag, '');
      const item = document.createElement('li');
      renderInline(item, bullet[1]);
      list.append(item);
      continue;
    }
    list = null;
    paragraph.push(line);
  }
  flushParagraph();
}

function blockButton(id) {
  return document.querySelector(`.block[data-id="${CSS.escape(id)}"] .block-open`);
}

function detailButton(id) {
  return document.querySelector(`.block[data-id="${CSS.escape(id)}"] .detail-button`);
}

function clearPreview() {
  if (!previewTarget) return;
  previewTarget = null;
  render();
}

function previewBlock(event, level, id) {
  if (!hoverPreview.matches || mobileLayout.matches || event.pointerType !== 'mouse' || detail.open) return;
  if (!state.visible[level].includes(id)) return;
  previewTarget = { level, id };
  render();
}

function renderSelectionPath(selected) {
  const signature = JSON.stringify(selected);
  if (signature === pathSelection) return;
  pathSelection = signature;
  selectionPath.replaceChildren();
  let previousLevel = null;
  selected.forEach((id, level) => {
    if (!id) return;
    if (previousLevel !== null) {
      const separator = document.createElement('span');
      separator.className = 'path-separator';
      separator.textContent = level === previousLevel + 1 ? '›' : '···';
      separator.setAttribute('aria-hidden', 'true');
      selectionPath.append(separator);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'path-step';
    button.dataset.level = level;
    button.textContent = itemFor(id).title;
    button.title = itemFor(id).title;
    button.setAttribute('aria-label', `返回${columns[level].getAttribute('aria-label')}：${itemFor(id).title}`);
    button.setAttribute('aria-current', level === activeLevel ? 'step' : 'false');
    button.addEventListener('click', () => {
      closeDetail();
      scrollToLevel(level, 'instant');
      blockButton(id)?.focus({ preventScroll: true });
    });
    selectionPath.append(button);
    previousLevel = level;
  });
  selectionPath.hidden = !selected.some(Boolean);
}

const svgNamespace = 'http://www.w3.org/2000/svg';
const relationLines = document.createElementNS(svgNamespace, 'svg');
relationLines.classList.add('relation-lines');
relationLines.setAttribute('aria-hidden', 'true');
board.prepend(relationLines);
let lineFrame = null;

function scheduleLines() {
  cancelAnimationFrame(lineFrame);
  lineFrame = requestAnimationFrame(drawLines);
}

function drawLines() {
  relationLines.replaceChildren();
  if (mobileLayout.matches || !viewSnapshot.focus) return;
  const boardRect = board.getBoundingClientRect();
  relationLines.setAttribute('viewBox', `0 0 ${boardRect.width} ${boardRect.height}`);
  for (const edge of viewSnapshot.edges) {
    const from = blockButton(edge.fromId)?.closest('.block');
    const to = blockButton(edge.toId)?.closest('.block');
    if (!from || !to) continue;
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const x1 = a.right - boardRect.left;
    const y1 = a.top + a.height / 2 - boardRect.top;
    const x2 = b.left - boardRect.left;
    const y2 = b.top + b.height / 2 - boardRect.top;
    const bend = (x2 - x1) * .5;
    const path = document.createElementNS(svgNamespace, 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`);
    path.classList.add('relation-line');
    path.classList.toggle('is-highlighted', edge.highlight);
    path.dataset.level = String(edge.toLevel);
    relationLines.append(path);
  }
}

function copyTextFor(level, item) {
  const url = level === 0 ? sourceUrlFor(item.id) : null;
  return [
    `# ${item.title}`,
    statusLabel(item) ? `状态：${statusLabel(item)}` : '',
    item.summary ?? '',
    url ? `来源：${url}` : '',
    item.body ?? '',
  ].filter(Boolean).join('\n\n');
}

async function copyBlock(level, id, button, tooltip) {
  const item = itemFor(id);
  try {
    await navigator.clipboard.writeText(copyTextFor(level, item));
    button.classList.add('is-copied');
    tooltip.textContent = '已复制';
    status.textContent = `已复制 ${item.title} 的标题、摘要和正文${level === 0 ? '及来源链接' : ''}`;
    setTimeout(() => {
      button.classList.remove('is-copied');
      tooltip.textContent = button.dataset.copyHint;
    }, 1800);
  } catch {
    tooltip.textContent = '复制失败，请打开详情后手动复制';
    status.textContent = tooltip.textContent;
    button.classList.add('copy-failed');
    setTimeout(() => {
      button.classList.remove('copy-failed');
      tooltip.textContent = button.dataset.copyHint;
    }, 3000);
  }
}

function makeBlock(level, id) {
  const item = itemFor(id);
  const slot = document.createElement('li');
  slot.className = 'slot';
  const block = document.createElement('div');
  block.className = 'block';
  block.dataset.id = id;
  block.dataset.level = level;
  const select = document.createElement('button');
  select.type = 'button';
  select.className = 'block-open';
  select.setAttribute('aria-label', `查看 ${item.title} 的关系；双击查看详情`);
  select.setAttribute('aria-keyshortcuts', 'F2');
  select.title = '悬停预览关系，单击选择，双击看详情';
  const dot = document.createElement('span');
  dot.className = 'block-dot';
  dot.setAttribute('aria-hidden', 'true');
  const title = document.createElement('span');
  title.className = 'block-title';
  title.textContent = item.title;
  select.append(dot, title);
  block.addEventListener('pointerenter', event => previewBlock(event, level, id));
  block.addEventListener('pointerleave', () => {
    if (previewTarget?.id === id) clearPreview();
  });
  // Defer pointer clicks briefly so double click opens without toggling selection.
  // Keep the same DOM button so its second click can emit dblclick.
  let clickTimer = null;
  let beforePointerClick = null;
  let clickApplied = false;
  select.addEventListener('click', event => {
    if (event.detail === 0) selectBlock(level, id);
    else if (event.detail === 1) {
      clearTimeout(clickTimer);
      beforePointerClick = state.selected;
      clickApplied = false;
      clickTimer = setTimeout(() => {
        if (select.isConnected) {
          selectBlock(level, id);
          clickApplied = true;
        }
      }, 280);
    }
  });
  select.addEventListener('dblclick', () => {
    clearTimeout(clickTimer);
    // A slower system double click may arrive after the single-click delay.
    if (clickApplied && beforePointerClick) {
      state.clearSelection();
      beforePointerClick.forEach((previous, previousLevel) => {
        if (previous) state.select(previousLevel, previous);
      });
      render();
    }
    clickApplied = false;
    openDetail(level, id);
  });
  select.addEventListener('keydown', event => {
    if (event.key === 'F2') {
      clearTimeout(clickTimer);
      event.preventDefault();
      openDetail(level, id);
    } else onBlockKey(event, level, id);
  });
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'detail-button';
  open.textContent = '详情 ↗';
  open.setAttribute('aria-label', `查看 ${item.title} 详情`);
  open.setAttribute('aria-haspopup', 'dialog');
  open.setAttribute('aria-controls', detail.id);
  open.addEventListener('click', () => openDetail(level, id));
  open.addEventListener('keydown', event => onBlockKey(event, level, id, true));
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'copy-button';
  copy.setAttribute('aria-label', `复制 ${item.title} 的内容`);
  copy.dataset.copyHint = `复制标题、摘要和正文${level === 0 ? '及来源链接' : ''}，可粘贴给 AI`;
  const copyIcon = document.createElementNS(svgNamespace, 'svg');
  copyIcon.setAttribute('viewBox', '0 0 20 20');
  copyIcon.setAttribute('aria-hidden', 'true');
  const iconPath = document.createElementNS(svgNamespace, 'path');
  iconPath.setAttribute('d', 'M7 7h9v10H7z M4 13H3V3h9v1');
  const checkPath = document.createElementNS(svgNamespace, 'path');
  checkPath.setAttribute('d', 'm5 10 3 3 7-7');
  checkPath.classList.add('copy-check');
  iconPath.classList.add('copy-icon');
  copyIcon.append(iconPath, checkPath);
  const tooltip = document.createElement('span');
  tooltip.className = 'action-tooltip';
  tooltip.id = `copy-hint-${id}`;
  tooltip.setAttribute('role', 'tooltip');
  tooltip.textContent = copy.dataset.copyHint;
  copy.setAttribute('aria-describedby', tooltip.id);
  copy.append(copyIcon, tooltip);
  copy.addEventListener('click', () => copyBlock(level, id, copy, tooltip));
  block.append(select, open, copy);
  const label = statusLabel(item);
  if (label) {
    const badge = document.createElement('span');
    badge.className = 'block-status';
    badge.textContent = label;
    block.append(badge);
  }
  slot.append(block);
  return slot;
}

function render() {
  viewSnapshot = previewTarget ? state.preview(previewTarget.level, previewTarget.id) : state.snapshot();
  const { visible, related, selected, dimmed } = viewSnapshot;
  columns.forEach((column, level) => {
    const list = column.querySelector('.slots');
    const existing = new Map([...list.children].map(slot => [slot.firstElementChild.dataset.id, slot]));
    const wanted = new Set(visible[level]);
    for (const [id, slot] of existing) if (!wanted.has(id)) slot.remove();
    visible[level].forEach((id, index) => {
      const slot = existing.get(id) ?? makeBlock(level, id);
      // Do not detach unchanged cards: preserve focus, double clicks and tooltips.
      if (list.children[index] !== slot) list.insertBefore(slot, list.children[index] ?? null);
      const block = slot.firstElementChild;
      const isActive = selected[level] === id;
      block.classList.toggle('is-active', isActive);
      block.classList.toggle('is-related', related[level].includes(id));
      block.classList.toggle('is-dimmed', dimmed[level].includes(id));
      block.classList.toggle('is-preview', previewTarget?.id === id && !isActive);
      block.querySelector('.block-open').setAttribute('aria-pressed', String(isActive));
    });
    switches[level].classList.toggle('has-related', related[level].length > 0);
  });
  renderSelectionPath(selected);
  scheduleLines();
}

function closeDetail(restoreFocus = false) {
  const id = detailTarget;
  detail.close();
  detailTarget = null;
  document.body.classList.remove('detail-open');
  if (restoreFocus && id) blockButton(id)?.focus({ preventScroll: true });
}

function selectBlock(level, id) {
  previewTarget = null;
  // A transient source preview can contain cards outside the fixed scope.
  if (!state.visible[level].includes(id)) { render(); return; }
  const { selected, visible } = state.select(level, id);
  render();
  blockButton(id)?.focus({ preventScroll: true });
  const counts = visible.map((ids, index) => `${columns[index].getAttribute('aria-label')} ${ids.length} 个块`).join('，');
  const relatedCount = state.related[2].length;
  const relationHint = selected.some(Boolean) ? `突出 ${relatedCount} 个关联技术，其余淡化` : '显示全部卡片';
  status.textContent = `${selected[level] === id ? '已选中' : '已取消选择'}，${counts}；${relationHint}`;
}

function openDetail(level, id) {
  clearPreview();
  const item = itemFor(id);
  detailTarget = id;
  detail.dataset.level = String(level);
  detail.querySelector('.detail-title').textContent = item.title;
  const metadata = [typeLabels[item.type] ?? item.type, statusLabel(item), ...archiveLabels(item), item.receivedAt ? `收录于 ${item.receivedAt}` : ''].filter(Boolean);
  detail.querySelector('.detail-meta').textContent = metadata.join(' · ');
  const summary = detail.querySelector('.detail-summary');
  summary.hidden = !item.summary;
  summary.textContent = item.summary ?? '';
  renderBody(detail.querySelector('.detail-body'), item.body);
  const url = level === 0 ? sourceUrlFor(id) : null;
  sourceLink.hidden = !url;
  if (url) sourceLink.href = url;
  else sourceLink.removeAttribute('href');
  detail.querySelector('.detail-scroll').scrollTop = 0;
  if (!detail.open) detail.showModal();
  document.body.classList.add('detail-open');
  closeButton.focus({ preventScroll: true });
}

function onBlockKey(event, level, id, isDetail = false) {
  if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  const ids = state.visible[level];
  const nextIndex = ids.indexOf(id) + (event.key === 'ArrowUp' ? -1 : 1);
  if (nextIndex < 0 || nextIndex >= ids.length) return;
  const button = isDetail ? detailButton(ids[nextIndex]) : blockButton(ids[nextIndex]);
  button?.focus();
}

closeButton.addEventListener('click', () => closeDetail(true));
detail.addEventListener('cancel', event => {
  event.preventDefault();
  closeDetail(true);
});
detail.addEventListener('click', event => {
  if (event.target !== detail) return;
  const rect = detail.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDetail(true);
});

function markLevel(level) {
  activeLevel = level;
  switches.forEach((button, index) => button.setAttribute('aria-current', String(index === level)));
  selectionPath.querySelectorAll('.path-step').forEach(button => {
    button.setAttribute('aria-current', Number(button.dataset.level) === level ? 'step' : 'false');
  });
}

function scrollToLevel(level, behavior = reducedMotion.matches ? 'instant' : 'smooth') {
  markLevel(level);
  board.scrollTo({ left: mobileLayout.matches ? columns[level].offsetLeft - columns[0].offsetLeft : 0, behavior });
}

switches.forEach((button, level) => button.addEventListener('click', () => {
  closeDetail();
  scrollToLevel(level);
}));
board.addEventListener('scroll', () => {
  if (!mobileLayout.matches) return;
  const center = board.getBoundingClientRect().left + board.clientWidth / 2;
  let nearest = 0;
  let distance = Infinity;
  columns.forEach((column, index) => {
    const rect = column.getBoundingClientRect();
    const current = Math.abs(rect.left + rect.width / 2 - center);
    if (current < distance) { distance = current; nearest = index; }
  });
  markLevel(nearest);
}, { passive: true });
board.addEventListener('focusin', event => {
  const column = event.target.closest('.column');
  if (mobileLayout.matches && column) scrollToLevel(Number(column.dataset.level), 'instant');
});
window.addEventListener('resize', () => {
  if (mobileLayout.matches) clearPreview();
  if (board.clientWidth === boardWidth) return;
  boardWidth = board.clientWidth;
  const level = activeLevel;
  requestAnimationFrame(() => scrollToLevel(level, 'instant'));
  scheduleLines();
});
window.addEventListener('blur', clearPreview);
document.addEventListener('keydown', clearPreview, { capture: true });
hoverPreview.addEventListener('change', () => { if (!hoverPreview.matches) clearPreview(); });
render();

new ResizeObserver(scheduleLines).observe(board);
document.fonts.ready.then(scheduleLines);
