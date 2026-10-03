import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const SOURCE_STATUSES = new Set(['pending', 'draft', 'reviewed']);
const DETAIL_STATUSES = new Set(['draft', 'reviewed']);

function fail(file, message) {
  throw new Error(`${file}: ${message}`);
}

function stringField(item, key, file) {
  if (typeof item[key] !== 'string' || !item[key].trim()) {
    fail(file, `${key} must be a non-empty string`);
  }
}

function isoDate(value, key, file) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
      || Number.isNaN(Date.parse(value))
      || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    fail(file, `${key} must be a valid ISO date (YYYY-MM-DD)`);
  }
}

function references(item, key, file) {
  if (!Array.isArray(item[key])) fail(file, `${key} must be an array of IDs`);
  for (const id of item[key]) {
    if (typeof id !== 'string' || !id.trim() || id !== id.trim()) {
      fail(file, `${key} must contain non-empty IDs without surrounding whitespace`);
    }
  }
  if (new Set(item[key]).size !== item[key].length) {
    fail(file, `${key} contains duplicate IDs`);
  }
}

function validateEntry(item, group, file) {
  for (const key of ['id', 'title', 'status']) stringField(item, key, file);
  if (item.id !== item.id.trim()) fail(file, 'id must not have surrounding whitespace');
  if (item.summary !== undefined && typeof item.summary !== 'string') {
    fail(file, 'summary must be a string');
  }
  if (item.preview !== undefined) {
    if (!Array.isArray(item.preview) || !item.preview.length) {
      fail(file, 'preview must be a non-empty array of labeled text');
    }
    for (const element of item.preview) {
      if (!element || typeof element !== 'object' || Array.isArray(element)) {
        fail(file, 'each preview element must contain a label and text');
      }
      for (const key of ['label', 'text']) stringField(element, key, file);
    }
  }
  const statuses = group === 'sources' ? SOURCE_STATUSES : DETAIL_STATUSES;
  if (!statuses.has(item.status)) {
    fail(file, `unknown status ${JSON.stringify(item.status)} for ${group}`);
  }

  if (group === 'sources') {
    stringField(item, 'type', file);
    stringField(item, 'url', file);
    let url;
    try {
      url = new URL(item.url);
    } catch {
      fail(file, 'url must be a valid HTTP(S) URL');
    }
    if (!/^https?:\/\//i.test(item.url) || !['http:', 'https:'].includes(url.protocol)
        || !url.hostname || item.url !== item.url.trim()) {
      fail(file, 'url must be a valid HTTP(S) URL');
    }
    isoDate(item.receivedAt, 'receivedAt', file);
    references(item, 'designs', file);
    if (item.status === 'pending' && item.designs.length) {
      fail(file, 'pending sources must have an empty designs array');
    }
  } else {
    if (Object.hasOwn(item, 'url')) fail(file, 'only sources may define an external url');
    if (group === 'designs') {
      if (Object.hasOwn(item, 'sources')) {
        fail(file, 'sources is generated from source.designs; remove it from design frontmatter');
      }
      references(item, 'technologies', file);
    } else {
      for (const key of ['designs', 'sources']) {
        if (Object.hasOwn(item, key)) {
          fail(file, `${key} is generated from design.technologies and source.designs; remove it from technology frontmatter`);
        }
      }
    }
  }
}

function isInside(directory, path) {
  const portion = relative(directory, path);
  return portion !== '' && portion !== '..' && !portion.startsWith(`..${sep}`)
    && !isAbsolute(portion);
}

async function sourceArchive(root, archive, file, verifyArchives) {
  if (archive === undefined) return { status: 'pending' };
  if (!archive || typeof archive !== 'object' || Array.isArray(archive)
      || !['pending', 'saved'].includes(archive.status)) {
    fail(file, 'archive must be an object with status pending or saved');
  }
  if (archive.status === 'pending') return { status: 'pending' };

  const path = archive.file;
  if (typeof path !== 'string' || !path.startsWith('.pocket/') || path.includes('\\')
      || isAbsolute(path) || !isInside(resolve(root, '.pocket'), resolve(root, path))) {
    fail(file, 'archive.file must be a relative path inside .pocket/');
  }
  isoDate(archive.capturedAt, 'archive.capturedAt', file);
  if (!['unknown', 'partial', 'checked'].includes(archive.completeness)) {
    fail(file, 'archive.completeness must be unknown, partial, or checked');
  }
  // Cloudflare checkouts omit private originals. Verify their presence locally.
  if (verifyArchives) {
    try {
      const [actualRoot, actualPocket, actualFile] = await Promise.all([
        realpath(root), realpath(join(root, '.pocket')), realpath(resolve(root, path)),
      ]);
      if (!isInside(actualRoot, actualPocket) || !isInside(actualPocket, actualFile)) {
        fail(file, 'archive.file resolves outside the repository .pocket directory');
      }
      const info = await stat(actualFile);
      if (!info.isFile() || info.size === 0) {
        fail(file, 'archive.file must be an existing non-empty file');
      }
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
        fail(file, 'archive.file must be an existing non-empty file');
      }
      throw error;
    }
  }
  // Private archive paths and contents never enter the public static catalog.
  return {
    status: 'saved', capturedAt: archive.capturedAt, completeness: archive.completeness,
  };
}

async function readEntries(root, group, verifyArchives) {
  const directory = join(root, 'content', group);
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const files = entries.filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => entry.name).sort();
  const result = [];
  for (const name of files) {
    const path = join(directory, name);
    const file = relative(root, path);
    const text = (await readFile(path, 'utf8')).replace(/^\uFEFF/, '');
    const parts = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(text);
    if (!parts) fail(file, 'expected JSON frontmatter between --- lines');
    let metadata;
    try {
      metadata = JSON.parse(parts[1]);
    } catch (error) {
      fail(file, `invalid JSON frontmatter: ${error.message}`);
    }
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      fail(file, 'frontmatter must contain a JSON object');
    }
    validateEntry(metadata, group, file);
    if (group === 'sources') {
      metadata.archive = await sourceArchive(root, metadata.archive, file, verifyArchives);
    }
    result.push({ item: { ...metadata, body: parts[2] }, file });
  }
  return result;
}

export async function loadCatalog(root, { verifyArchives = false } = {}) {
  const groups = ['sources', 'designs', 'technologies'];
  const records = {};
  for (const group of groups) records[group] = await readEntries(root, group, verifyArchives);

  const allIds = new Map();
  for (const group of groups) {
    for (const { item, file } of records[group]) {
      if (allIds.has(item.id)) {
        fail(file, `duplicate id ${JSON.stringify(item.id)}; already used in ${allIds.get(item.id)}`);
      }
      allIds.set(item.id, file);
    }
  }

  const ids = Object.fromEntries(groups.map(group => [
    group, new Set(records[group].map(({ item }) => item.id)),
  ]));
  function checkReferences(record, key, target) {
    for (const id of record.item[key]) {
      if (!ids[target].has(id)) {
        fail(record.file, `${key} references missing ${target} ID ${JSON.stringify(id)}`);
      }
    }
  }
  for (const record of records.sources) checkReferences(record, 'designs', 'designs');
  for (const record of records.designs) checkReferences(record, 'technologies', 'technologies');

  // Store each relationship once in Markdown, then derive reverse provenance.
  for (const record of records.designs) {
    record.item.sources = records.sources
      .filter(source => source.item.designs.includes(record.item.id))
      .map(source => source.item.id);
    if (!record.item.sources.length) {
      fail(record.file, 'design has no source; reference its ID from a source.designs array');
    }
  }
  for (const record of records.technologies) {
    const designs = records.designs
      .filter(design => design.item.technologies.includes(record.item.id));
    record.item.designs = designs.map(design => design.item.id);
    const sourceIds = new Set(designs.flatMap(design => design.item.sources));
    record.item.sources = records.sources
      .filter(source => sourceIds.has(source.item.id)).map(source => source.item.id);
    if (!record.item.designs.length) {
      fail(record.file, 'technology has no design; reference its ID from a design.technologies array');
    }
  }
  return Object.fromEntries(groups.map(group => [
    group, records[group].map(({ item }) => item),
  ]));
}
