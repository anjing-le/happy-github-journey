import { createBoardState } from './board-state.js';
import { sourceUrlFor } from './content.js';

const state = createBoardState();
const columns = [...document.querySelectorAll('.column')];
const board = document.querySelector('.board');
const detail = document.querySelector('.detail');
const switches = [...document.querySelectorAll('[data-jump]')];
const status = document.querySelector('#status');
const closeButton = document.querySelector('.close-detail');
const sourceLink = document.querySelector('.source-link');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let detailTarget = null;

function blockButton(id) {
  return document.querySelector(`.block[data-id="${id}"] .block-open`);
}

function detailButton(id) {
  return document.querySelector(`.block[data-id="${id}"] .detail-button`);
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
      const originalIndex = Number(id.split('-').at(-1)) - 1;
      const slot = document.createElement('li');
      slot.className = 'slot';
      const block = document.createElement('div');
      block.className = 'block';
      block.dataset.id = id;
      block.dataset.level = level;
      block.style.setProperty('--line-width', `${[52, 66, 44, 59, 48][originalIndex]}%`);
      const isActive = selected[level] === id;
      block.classList.toggle('is-active', isActive);
      block.classList.toggle('is-related', related[level].includes(id));
      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'block-open';
      select.setAttribute('aria-label', `选中第${level + 1}层空白块${originalIndex + 1}`);
      select.setAttribute('aria-pressed', String(isActive));
      select.innerHTML = '<span class="block-dot" aria-hidden="true"></span>';
      select.addEventListener('click', () => selectBlock(level, id));
      select.addEventListener('keydown', event => onBlockKey(event, level, id));
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'detail-button';
      open.setAttribute('aria-label', `查看第${level + 1}层空白块${originalIndex + 1}详情`);
      open.setAttribute('aria-haspopup', 'dialog');
      open.setAttribute('aria-controls', detail.id);
      open.innerHTML = '<span class="block-title" aria-hidden="true"></span>';
      open.addEventListener('click', () => openDetail(level, id));
      open.addEventListener('keydown', event => onBlockKey(event, level, id, true));
      block.append(select, open);
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
  detailTarget = id;
  detail.dataset.level = String(level);
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
  button?.focus({ preventScroll: true });
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

switches.forEach((button, level) => button.addEventListener('click', () => {
  closeDetail();
  board.scrollTo({ left: columns[level].offsetLeft - columns[0].offsetLeft, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
}));
board.addEventListener('scroll', () => {
  const left = board.getBoundingClientRect().left + 24;
  let nearest = 0;
  let distance = Infinity;
  columns.forEach((column, index) => {
    const current = Math.abs(column.getBoundingClientRect().left - left);
    if (current < distance) { distance = current; nearest = index; }
  });
  switches.forEach((button, index) => button.setAttribute('aria-current', String(index === nearest)));
}, { passive: true });
render();
