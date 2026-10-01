// Fonte da verdade do cliente desta pasta.
// Precedencia: CT_CLIENT > .workspace > clients/active-client.md (legado).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"

// ALLOWED = toda pasta em clients/ com brand-profile.md, exceto _template.
// Generico de proposito: qualquer cliente novo (ex: acme) so precisa
// da pasta clients/{slug}/brand-profile.md pra virar cliente valido aqui.
function scanClients(root) {
  const dir = join(root, "clients")
  if (!existsSync(dir)) return new Set()
  const slugs = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "_template")
    .filter((d) => existsSync(join(dir, d.name, "brand-profile.md")))
    .map((d) => d.name)
  return new Set(slugs)
}

export const ALLOWED = scanClients(process.cwd())

function parseClient(text) {
  const m = String(text).match(/^\s*client:\s*([a-z0-9-]+)\s*$/m)
  return m ? m[1] : null
}

export function resolveClient(root = process.cwd()) {
  const allowed = scanClients(root)
  if (process.env.CT_CLIENT) {
    if (!allowed.has(process.env.CT_CLIENT)) {
      throw new Error(`CT_CLIENT invalido: ${process.env.CT_CLIENT}`)
    }
    return process.env.CT_CLIENT
  }
  const ws = join(root, ".workspace")
  if (existsSync(ws)) {
    const slug = parseClient(readFileSync(ws, "utf8"))
    if (!slug || !allowed.has(slug)) {
      throw new Error(`.workspace client invalido (use um dos: ${[...allowed].join(", ")})`)
    }
    return slug
  }
  const legacy = join(root, "clients", "active-client.md")
  if (existsSync(legacy)) {
    const slug = parseClient(readFileSync(legacy, "utf8"))
    if (slug && allowed.has(slug)) return slug
  }
  throw new Error("sem .workspace, CT_CLIENT ou active-client.md. Copie .workspace.example")
}

export function assertClient(slug, root = process.cwd()) {
  const got = resolveClient(root)
  if (got !== slug) {
    throw new Error(
      `workspace e ${got}; recusado ${slug}. Troque o client do .workspace para ${slug}`,
    )
  }
  return got
}

export function bootstrapActiveClient(root = process.cwd()) {
  const slug = resolveClient(root)
  const dir = join(root, "clients")
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const body =
    `# Cliente Ativo\n\n` +
    `client: ${slug}\n\n` +
    `# Gerado por npm run workspace:boot a partir de .workspace.\n` +
    `# Nao commitar. Fonte da verdade: .workspace (gitignored).\n`
  writeFileSync(join(dir, "active-client.md"), body, "utf8")
  return slug
}

export function playwrightDir(kind, root = process.cwd()) {
  const home = process.env.USERPROFILE || process.env.HOME
  return resolve(home, `.playwright-${kind}-${resolveClient(root)}`)
}
