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

function render(animate = false) {
  const oldRects = new Map();
  if (animate && !reducedMotion.matches) {
    document.querySelectorAll('.block').forEach(block => oldRects.set(block.dataset.id, block.getBoundingClientRect()));
  }
  const { visible, related, selected } = state.snapshot();
  columns.forEach((column, level) => {
    const list = column.querySelector('.slots');
    list.replaceChildren();
    visible[level].forEach(id => {
      const item = itemFor(id);
      const slot = document.createElement('li');
      slot.className = 'slot';
      const block = document.createElement('div');
      block.className = 'block';
      block.dataset.id = id;
      block.dataset.level = level;
      const isActive = selected[level] === id;
      block.classList.toggle('is-active', isActive);
      block.classList.toggle('is-related', related[level].includes(id));
      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'block-open';
      select.setAttribute('aria-label', `筛选 ${item.title}`);
      select.setAttribute('aria-pressed', String(isActive));
      const dot = document.createElement('span');
      dot.className = 'block-dot';
      dot.setAttribute('aria-hidden', 'true');
      select.append(dot);
      select.addEventListener('click', () => selectBlock(level, id));
      select.addEventListener('keydown', event => onBlockKey(event, level, id));
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'detail-button';
      open.setAttribute('aria-label', `查看 ${item.title} 详情`);
      open.setAttribute('aria-haspopup', 'dialog');
      open.setAttribute('aria-controls', detail.id);
      const title = document.createElement('span');
      title.className = 'block-title';
      title.textContent = item.title;
      open.append(title);
      open.addEventListener('click', () => openDetail(level, id));
      open.addEventListener('keydown', event => onBlockKey(event, level, id, true));
      block.append(select, open);
      const label = statusLabel(item);
      if (label) {
        const badge = document.createElement('span');
        badge.className = 'block-status';
        badge.textContent = label;
        block.append(badge);
      }
      slot.append(block);
      list.append(slot);
    });
    switches[level].classList.toggle('has-related', related[level].length > 0);
  });
  oldRects.forEach((oldRect, id) => {
    const block = blockButton(id)?.closest('.block');
    if (!block) return;
    const next = block.getBoundingClientRect();
    if (Math.abs(oldRect.top - next.top) > 1) {
      block.animate([{ transform: `translateY(${oldRect.top - next.top}px)` }, { transform: 'translateY(0)' }], { duration: 250, easing: 'cubic-bezier(.2,.7,.2,1)' });
    }
  });
}

function closeDetail(restoreFocus = false) {
  const id = detailTarget;
  detail.close();
  detailTarget = null;
  document.body.classList.remove('detail-open');
  if (restoreFocus && id) detailButton(id)?.focus({ preventScroll: true });
}

function selectBlock(level, id) {
  const { selected, visible } = state.select(level, id);
  render(true);
  blockButton(id)?.focus({ preventScroll: true });
  const counts = visible.map((ids, index) => `${columns[index].getAttribute('aria-label')} ${ids.length} 个块`).join('，');
  status.textContent = `${selected[level] === id ? '已选中' : '已取消选择'}，${counts}`;
}

function openDetail(level, id) {
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
  if (board.clientWidth === boardWidth) return;
  boardWidth = board.clientWidth;
  const level = activeLevel;
  requestAnimationFrame(() => scrollToLevel(level, 'instant'));
});
render();
