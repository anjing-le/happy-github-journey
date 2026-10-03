import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { loadCatalog } from './catalog.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const completeCatalog = await loadCatalog(root);
const catalog = JSON.parse(await readFile(join(root, 'dist/catalog.json'), 'utf8'));
const entries = Object.values(catalog).flat();
let moduleNumber = 0;

function freshContent() {
  const url = pathToFileURL(join(root, 'dist/content.js'));
  url.searchParams.set('contract-test', String(++moduleNumber));
  return import(url.href);
}

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json' },
  });
}

async function withFetch(fetchImpl, run) {
  const original = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try { await run(); } finally { globalThis.fetch = original; }
}

test('light catalog preserves metadata and every hashed detail preserves its exact body', async () => {
  const files = await readdir(join(root, 'dist/details'));
  assert.equal(files.length, entries.length);
  for (const [group, completeItems] of Object.entries(completeCatalog)) {
    assert.equal(catalog[group].length, completeItems.length);
    for (const full of completeItems) {
      const light = catalog[group].find(item => item.id === full.id);
      const { body, ...metadata } = full;
      const { bodyUrl, ...publishedMetadata } = light;
      assert.equal(Object.hasOwn(light, 'body'), false);
      assert.deepEqual(publishedMetadata, metadata);
      assert.match(bodyUrl, /^\/details\/[a-f0-9]{64}\.json$/);
      const payloadText = await readFile(join(root, 'dist', bodyUrl.slice(1)), 'utf8');
      assert.deepEqual(JSON.parse(payloadText), { id: full.id, body });
      const digest = createHash('sha256').update(payloadText).digest('hex');
      assert.equal(bodyUrl, `/details/${digest}.json`);
    }
  }
  assert.equal(JSON.stringify(catalog).includes('.pocket/'), false);
});

test('import fetches no bodies; concurrent and completed loads reuse one request', async () => {
  let count = 0;
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const light = entries[0];
  const full = Object.values(completeCatalog).flat().find(item => item.id === light.id);
  await withFetch(async (url, options) => {
    count++;
    assert.equal(url, light.bodyUrl);
    assert.equal(options.mode, 'same-origin');
    assert.equal(options.redirect, 'error');
    await waiting;
    return jsonResponse({ id: full.id, body: full.body });
  }, async () => {
    const content = await freshContent();
    assert.equal(count, 0);
    assert.equal(content.cachedItemFor(full.id), null);
    assert.equal(Object.hasOwn(content.itemFor(full.id), 'body'), false);
    const first = content.loadItem(full.id);
    assert.equal(content.loadItem(full.id), first);
    assert.equal(count, 1);
    assert.equal(content.cachedItemFor(full.id), null);
    release();
    const loaded = await first;
    assert.equal(loaded.body, full.body);
    assert.equal(content.cachedItemFor(full.id), loaded);
    assert.equal(content.loadItem(full.id), first);
    assert.equal(count, 1);
    assert.equal(Object.hasOwn(content.itemFor(full.id), 'body'), false);
  });
});

test('HTTP, HTML, network and payload failures never poison the cache and can retry', async () => {
  const id = entries[0].id;
  const variants = [
    () => new Response('<html>Service unavailable</html>', { status: 503 }),
    () => new Response('<html>Not a detail document</html>'),
    () => jsonResponse({ id: 'another-item', body: 'wrong body' }),
    () => jsonResponse({ id, body: 123 }),
    () => jsonResponse([{ id, body: 'not an object' }]),
    () => { throw new TypeError('Network unavailable'); },
  ];
  let attempts = 0;
  let response = variants[0];
  await withFetch(async () => { attempts++; return response(); }, async () => {
    const content = await freshContent();
    for (response of variants) {
      await assert.rejects(content.loadItem(id));
      assert.equal(content.cachedItemFor(id), null);
    }
    response = () => jsonResponse({ id, body: '' });
    const loaded = await content.loadItem(id);
    assert.equal(loaded.body, '');
    assert.equal(attempts, variants.length + 1);
    assert.equal(content.cachedItemFor(id), loaded);
    await content.loadItem(id);
    assert.equal(attempts, variants.length + 1);
  });
});

test('unknown IDs and non-generated URLs are rejected before fetch', async () => {
  let attempts = 0;
  await withFetch(async () => { attempts++; throw new Error('must not fetch'); }, async () => {
    const content = await freshContent();
    await assert.rejects(content.loadItem('missing-item'));
    assert.equal(content.cachedItemFor('missing-item'), null);
    const metadata = content.itemFor(entries[0].id);
    const original = metadata.bodyUrl;
    try {
      for (const invalid of ['https://other.example/detail.json', '//other.example/detail.json',
        '/details/../catalog.json', '/details/a.json']) {
        metadata.bodyUrl = invalid;
        await assert.rejects(content.loadItem(metadata.id));
      }
    } finally { metadata.bodyUrl = original; }
    assert.equal(attempts, 0);
  });
});

test('a timed-out shared request releases its timer and permits a fresh retry', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timers = new Map();
  let timerNumber = 0;
  globalThis.setTimeout = (callback, delay, ...args) => {
    if (delay !== 15000) return originalSetTimeout(callback, delay, ...args);
    const timer = { detailTimer: ++timerNumber };
    timers.set(timer, callback);
    return timer;
  };
  globalThis.clearTimeout = timer => {
    if (timer?.detailTimer) timers.delete(timer);
    else originalClearTimeout(timer);
  };
  const id = entries[0].id;
  let attempts = 0;
  let retry = false;
  try {
    await withFetch(async (_url, { signal }) => {
      attempts++;
      if (retry) return jsonResponse({ id, body: 'retry succeeded' });
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')), { once: true });
      });
    }, async () => {
      const content = await freshContent();
      const request = content.loadItem(id);
      assert.equal(content.loadItem(id), request);
      assert.equal(attempts, 1);
      assert.equal(timers.size, 1);
      [...timers.values()][0]();
      await assert.rejects(request, { name: 'AbortError' });
      assert.equal(timers.size, 0);
      assert.equal(content.cachedItemFor(id), null);
      retry = true;
      assert.equal((await content.loadItem(id)).body, 'retry succeeded');
      assert.equal(attempts, 2);
      assert.equal(timers.size, 0);
    });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});
