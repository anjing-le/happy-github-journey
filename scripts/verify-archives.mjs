import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './catalog.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const catalog = await loadCatalog(root, { verifyArchives: true });
const count = catalog.sources.filter(source => source.archive.status === 'saved').length;
console.log(`Verified ${count} saved source archive(s) in local .pocket/.`);
