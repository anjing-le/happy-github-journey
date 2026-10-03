import { catalog } from './catalog.js';

export { catalog };

const items = new Map([
  ...catalog.sources,
  ...catalog.designs,
  ...catalog.technologies,
].map(item => [item.id, item]));
const loadedItems = new Map();
const requests = new Map();

export function itemFor(id) {
  return items.get(id) ?? null;
}

export function cachedItemFor(id) {
  return loadedItems.get(id) ?? null;
}

// Return the same Promise for concurrent callers and successful cached loads.
export function loadItem(id) {
  if (requests.has(id)) return requests.get(id);
  const item = itemFor(id);
  if (!item) return Promise.reject(new Error(`Unknown content item: ${id}`));
  if (typeof item.bodyUrl !== 'string' || !/^\/details\/[a-f0-9]{64}\.json$/.test(item.bodyUrl)) {
    return Promise.reject(new Error('Invalid content detail URL'));
  }
  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(item.bodyUrl, {
        mode: 'same-origin', credentials: 'same-origin', redirect: 'error',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Content request failed: HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)
          || payload.id !== id || typeof payload.body !== 'string') {
        throw new Error('Invalid content detail payload');
      }
      const complete = { ...item, body: payload.body };
      loadedItems.set(id, complete);
      return complete;
    } finally {
      clearTimeout(timeout);
    }
  })().catch(error => {
    requests.delete(id);
    throw error;
  });
  requests.set(id, request);
  return request;
}

export function sourceUrlFor(id) {
  const value = items.get(id)?.url;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
