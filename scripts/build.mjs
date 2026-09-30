import { cp, rm } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const source = join(root, "site")
const output = join(root, "dist")

await rm(output, { recursive: true, force: true })
await cp(source, output, { recursive: true })
console.log("Built static site in dist/")
