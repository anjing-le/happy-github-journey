// Blank interaction scaffolding. Fill these with real provenance when adding material.
export const SOURCE_URLS = {
  'source-1': null,
  'source-2': null,
  'source-3': null,
  'source-4': null,
  'source-5': null,
};

export function sourceUrlFor(id) {
  const value = SOURCE_URLS[id];
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
