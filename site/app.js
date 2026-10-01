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
let drag = null;
let detailTarget = null;
let suppressClickUntil = 0;

function blockButton(id) {
  return document.querySelector(`.block[data-id="${id}"] .block-open`);
}

function render(animate = false) {
  const oldRects = new Map();
  if (animate && !reducedMotion.matches) {
    document.querySelectorAll('.block').forEach(block => oldRects.set(block.dataset.id, block.getBoundingClientRect()));
  }
  const { ordered, related, active } = state;
  columns.forEach((column, level) => {
    const list = column.querySelector('.slots');
    list.replaceChildren();
    ordered[level].forEach(id => {
      const originalIndex = Number(id.split('-').at(-1)) - 1;
      const slot = document.createElement('li');
      slot.className = 'slot';
      const block = document.createElement('div');
      block.className = 'block';
      block.dataset.id = id;
      block.dataset.level = level;
      const isActive = active?.id === id;
      block.classList.toggle('is-active', isActive);
      block.classList.toggle('is-related', related[level].includes(id));
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'block-open';
      open.setAttribute('aria-label', `第${level + 1}层空白块${originalIndex + 1}，查看详情`);
      open.setAttribute('aria-pressed', String(isActive));
      open.setAttribute('aria-haspopup', 'dialog');
      open.innerHTML = '<span class="block-dot" aria-hidden="true"></span><span class="block-title" aria-hidden="true"></span>';
      open.style.setProperty('--line-width', `${[52, 66, 44, 59, 48][originalIndex]}%`);
      open.addEventListener('click', () => selectBlock(level, id));
      open.addEventListener('keydown', event => onBlockKey(event, level, id));
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'drag-handle';
      handle.setAttribute('aria-label', `拖动第${level + 1}层空白块${originalIndex + 1}排序`);
      handle.innerHTML = '<svg viewBox="0 0 14 22" aria-hidden="true"><circle cx="4" cy="5" r="1.2"/><circle cx="10" cy="5" r="1.2"/><circle cx="4" cy="11" r="1.2"/><circle cx="10" cy="11" r="1.2"/><circle cx="4" cy="17" r="1.2"/><circle cx="10" cy="17" r="1.2"/></svg>';
      handle.addEventListener('pointerdown', event => beginDrag(event, level, id, block, handle));
      handle.addEventListener('keydown', event => onBlockKey(event, level, id, true));
      block.append(open, handle);
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
  if (restoreFocus && id) blockButton(id)?.focus({ preventScroll: true });
}

function selectBlock(level, id) {
  if (performance.now() < suppressClickUntil) return;
  if (drag) endDrag({ pointerId: drag.pointerId }, true);
  if (state.active?.id === id && detail.open && detailTarget === id) {
    closeDetail(true);
    return;
  }
  state.select(level, id);
  render(true);
  detailTarget = id;
  const url = level === 0 ? sourceUrlFor(id) : null;
  sourceLink.hidden = !url;
  if (url) sourceLink.href = url;
  else sourceLink.removeAttribute('href');
  detail.querySelector('.detail-scroll').scrollTop = 0;
  if (!detail.open) detail.showModal();
  document.body.classList.add('detail-open');
  closeButton.focus({ preventScroll: true });
}

function onBlockKey(event, level, id, isHandle = false) {
  if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  const ids = state.ordered[level];
  const index = ids.indexOf(id);
  const nextIndex = index + (event.key === 'ArrowUp' ? -1 : 1);
  if (nextIndex < 0 || nextIndex >= ids.length) return;
  if (event.altKey) {
    state.move(level, id, event.key === 'ArrowUp' ? ids[nextIndex] : ids[nextIndex + 1] ?? null);
    render(true);
    status.textContent = '块顺序已调整';
    if (isHandle) blockButton(id)?.closest('.block').querySelector('.drag-handle').focus({ preventScroll: true });
    else blockButton(id)?.focus({ preventScroll: true });
  } else {
    blockButton(ids[nextIndex])?.focus({ preventScroll: true });
  }
}

function beginDrag(event, level, id, block, handle) {
  if (event.button !== 0 || drag || detail.open) return;
  event.preventDefault();
  const rect = block.getBoundingClientRect();
  drag = { level, id, block, handle, pointerId: event.pointerId, startY: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, rect, started: false, target: undefined };
  handle.setPointerCapture(event.pointerId);
}

function clearDropIndicators() {
  document.querySelectorAll('.drop-before, .drop-end').forEach(element => element.classList.remove('drop-before', 'drop-end'));
}

document.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (!drag.started && Math.abs(event.clientY - drag.startY) < 6) return;
  event.preventDefault();
  if (!drag.started) {
    closeDetail();
    drag.started = true;
    drag.ghost = drag.block.cloneNode(true);
    drag.ghost.classList.add('drag-preview');
    drag.ghost.setAttribute('aria-hidden', 'true');
    drag.ghost.inert = true;
    drag.ghost.style.width = `${drag.rect.width}px`;
    drag.ghost.style.height = `${drag.rect.height}px`;
    document.body.append(drag.ghost);
    drag.block.classList.add('drag-source');
    document.body.classList.add('is-dragging');
  }
  drag.ghost.style.left = `${drag.rect.left}px`;
  drag.ghost.style.top = `${event.clientY - drag.offsetY}px`;
  const list = columns[drag.level].querySelector('.slots');
  const listRect = list.getBoundingClientRect();
  clearDropIndicators();
  if (event.clientX < listRect.left - 24 || event.clientX > listRect.right + 24) {
    drag.target = undefined;
    return;
  }
  const candidates = [...list.querySelectorAll('.block')].filter(block => block.dataset.id !== drag.id);
  const next = candidates.find(block => {
    const rect = block.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2;
  });
  drag.target = next?.dataset.id ?? null;
  if (next) next.closest('.slot').classList.add('drop-before');
  else list.classList.add('drop-end');
}, { passive: false });

function endDrag(event, cancelled = false) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const current = drag;
  drag = null;
  if (current.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId);
  current.ghost?.remove();
  current.block.classList.remove('drag-source');
  document.body.classList.remove('is-dragging');
  clearDropIndicators();
  if (current.started) suppressClickUntil = performance.now() + 300;
  if (current.started && !cancelled && current.target !== undefined) {
    state.move(current.level, current.id, current.target);
    render(true);
    status.textContent = '块顺序已调整';
    blockButton(current.id)?.closest('.block').querySelector('.drag-handle').focus({ preventScroll: true });
  }
}

document.addEventListener('pointerup', event => endDrag(event));
document.addEventListener('pointercancel', event => endDrag(event, true));
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
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (drag) endDrag({ pointerId: drag.pointerId }, true);
  }
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
