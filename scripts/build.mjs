import { createHash } from "node:crypto"
import { cp, readFile, rm, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { loadCatalog } from "./catalog.mjs"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const source = join(root, "site")
const output = join(root, "dist")

function hash(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 12)
}

function replaceOnce(content, expected, replacement, file, label) {
  const occurrences = typeof expected === "string"
    ? content.split(expected).length - 1
    : [...content.matchAll(expected)].length
  if (occurrences !== 1) {
    throw new Error(`${file}: expected exactly one ${label}; found ${occurrences}`)
  }
  return content.replace(expected, replacement)
}

// Validate the Markdown source before replacing a previously successful build.
const catalog = await loadCatalog(root)
const json = JSON.stringify(catalog, null, 2)
const moduleJson = json.replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")
const catalogModule = `// Generated from content/**/*.md; do not edit.\nexport const catalog = ${moduleJson};\n`
const [originalContent, boardState, originalApp, styles, originalIndex] = await Promise.all([
  "content.js", "board-state.js", "app.js", "styles.css", "index.html",
].map(file => readFile(join(source, file), "utf8")))

// Version only this site's known dependency chain; source imports stay clean.
const contentModule = replaceOnce(originalContent, "from './catalog.js';",
  `from './catalog.js?v=${hash(catalogModule)}';`, "site/content.js", "catalog import")
let appModule = replaceOnce(originalApp, "from './board-state.js';",
  `from './board-state.js?v=${hash(boardState)}';`, "site/app.js", "board-state import")
appModule = replaceOnce(appModule, "from './content.js';",
  `from './content.js?v=${hash(contentModule)}';`, "site/app.js", "content import")
let index = replaceOnce(originalIndex, /href="\/styles\.css(?:\?[^"\s]*)?"/g,
  `href="/styles.css?v=${hash(styles)}"`, "site/index.html", "stylesheet entry")
index = replaceOnce(index, /src="\/app\.js(?:\?[^"\s]*)?"/g,
  `src="/app.js?v=${hash(appModule)}"`, "site/index.html", "app entry")

await rm(output, { recursive: true, force: true })
await cp(source, output, { recursive: true })
await writeFile(join(output, "catalog.json"), `${json}\n`)
await writeFile(join(output, "catalog.js"), catalogModule)
await writeFile(join(output, "content.js"), contentModule)
await writeFile(join(output, "app.js"), appModule)
await writeFile(join(output, "index.html"), index)
console.log("Built static site in dist/")
