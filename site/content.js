import { catalog } from './catalog.js';

export { catalog };

const items = new Map([
  ...catalog.sources,
  ...catalog.designs,
  ...catalog.technologies,
].map(item => [item.id, item]));

export function itemFor(id) {
  return items.get(id) ?? null;
}

export function sourceUrlFor(id) {
  const value = catalog.sources.find(item => item.id === id)?.url;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
