#!/usr/bin/env node
/**
 * Gera wiki/ (estilo DeepWiki) a partir das fontes unicas do repo:
 * agents (pasta agents), skills (pasta skills, um SKILL.md por skill),
 * references/skill-agent-map.md e .env.local.example.
 *
 * Paginas geradas levam o marcador GERADO no topo e sao sempre
 * sobrescritas. Paginas manuais so sao criadas se nao existirem.
 * Paginas mistas (manual + gerado) guardam o trecho gerado entre
 * marcadores <!-- WIKI:GERADO:START/END --> e preservam o resto.
 *
 * Uso:
 *   node scripts/gen-wiki.mjs            # gera/atualiza
 *   node scripts/gen-wiki.mjs --check    # sai com codigo 1 se algo gerado estiver desatualizado
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const WIKI = join(ROOT, "wiki")
const CHECK = process.argv.includes("--check")

const GEN_HEADER = (src) =>
  `<!-- GERADO por scripts/gen-wiki.mjs a partir de ${src}. Nao editar na mao. -->\n\n`

// ---------------------------------------------------------------------------
// Sanitizacao: nunca deixar token/segredo/e-mail vazar pra wiki
// ---------------------------------------------------------------------------
const SECRET_PATTERNS = [
  /EAA[A-Za-z0-9]{20,}/,
  /sk-[A-Za-z0-9_-]{10,}/,
  /ghp_[A-Za-z0-9]{10,}/,
  /act_\d+/,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
]

function sanitize(text) {
  return text
    .split("\n")
    .filter((line) => !SECRET_PATTERNS.some((re) => re.test(line)))
    .join("\n")
}

// ---------------------------------------------------------------------------
// Helpers de arquivo
// ---------------------------------------------------------------------------
const pending = [] // { path, content } a escrever ou conferir
const manualSkeletons = [] // { path, content } so cria se nao existir

function planGenerated(relPath, content) {
  pending.push({ path: join(WIKI, relPath), content: sanitize(content) })
}

function planManual(relPath, content) {
  manualSkeletons.push({ path: join(WIKI, relPath), content: sanitize(content) })
}

function planManaged(relPath, generatedBlock, fullTemplateIfMissing) {
  const abs = join(WIKI, relPath)
  const block = sanitize(generatedBlock)
  if (!existsSync(abs)) {
    manualSkeletons.push({ path: abs, content: sanitize(fullTemplateIfMissing(block)) })
    return
  }
  const current = readFileSync(abs, "utf8")
  const start = "<!-- WIKI:GERADO:START -->"
  const end = "<!-- WIKI:GERADO:END -->"
  const i = current.indexOf(start)
  const j = current.indexOf(end)
  if (i === -1 || j === -1 || j < i) {
    // marcadores sumiram: nao mexe no manual, so avisa via check
    pending.push({ path: abs, content: current, skipWrite: true, markerMissing: true })
    return
  }
  const next = current.slice(0, i + start.length) + "\n" + block + "\n" + current.slice(j)
  pending.push({ path: abs, content: next })
}

// ---------------------------------------------------------------------------
// Frontmatter minimo (sem dependencia nova: nao ha gray-matter no package.json)
// ---------------------------------------------------------------------------
function parseFrontmatter(rawIn) {
  const raw = rawIn.replace(/\r\n/g, "\n") // normaliza CRLF (varios .md do repo usam)
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { meta: {}, body: raw }
  const [, fmText, body] = m
  const meta = {}
  for (const line of fmText.split("\n")) {
    const km = line.match(/^([A-Za-z_]+):\s*(.*)$/)
    if (!km) continue
    const [, key, rawVal] = km
    let val = rawVal.trim()
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    meta[key] = val
  }
  return { meta, body }
}

function firstParagraphAfter(body, h2Index) {
  const lines = body.slice(h2Index).split("\n").slice(1)
  const para = []
  for (const line of lines) {
    if (/^##?\s/.test(line)) break
    if (line.trim() === "" && para.length) break
    if (line.trim() === "") continue
    para.push(line.trim())
    if (para.join(" ").length > 320) break
  }
  return para.join(" ").slice(0, 320)
}

function extractSections(body) {
  const sections = []
  const re = /^##\s+(.+)$/gm
  let m
  const indices = []
  while ((m = re.exec(body))) indices.push({ title: m[1].trim(), index: m.index })
  for (const { title, index } of indices) {
    sections.push({ title, summary: firstParagraphAfter(body, index) })
  }
  return sections
}

function findMentions(body, slugs, exclude) {
  const found = []
  for (const slug of slugs) {
    if (slug === exclude) continue
    const re = new RegExp(`(?<![\\w-])${slug}(?![\\w-])`)
    if (re.test(body)) found.push(slug)
  }
  return found
}

// ---------------------------------------------------------------------------
// 1) Agentes: 02-agentes/{slug}.md + 02-agentes/README.md
// ---------------------------------------------------------------------------
const AGENTS_DIR = join(ROOT, "agents")
const agentFiles = readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md"))
const agentSlugs = agentFiles.map((f) => f.replace(/\.md$/, ""))

const SKILLS_DIR = join(ROOT, "skills")
const skillSlugs = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(SKILLS_DIR, d.name, "SKILL.md")))
  .map((d) => d.name)

const agentRows = []

for (const file of agentFiles) {
  const slug = file.replace(/\.md$/, "")
  const raw = readFileSync(join(AGENTS_DIR, file), "utf8")
  const { meta, body } = parseFrontmatter(raw)
  const sections = extractSections(body)
  const skillsUsed = findMentions(body, skillSlugs)
  const delegatesTo = findMentions(body, agentSlugs, slug)

  agentRows.push({
    slug,
    description: meta.description || "",
  })

  let page = GEN_HEADER(`agents/${file}`)
  page += `# ${slug}\n\n`
  page += `${meta.description || "(sem descricao)"}\n\n`
  page += `- Arquivo fonte: \`agents/${file}\`\n`
  page += `- Modelo: \`${meta.model || "-"}\`\n`
  page += `- Ferramentas: ${meta.tools || "-"}\n`
  if (skillsUsed.length) {
    page += `- Skills que usa: ${skillsUsed.map((s) => `[${s}](../03-skills/README.md)`).join(", ")}\n`
  }
  if (delegatesTo.length) {
    page += `- Menciona/delega para: ${delegatesTo.map((s) => `[${s}](${s}.md)`).join(", ")}\n`
  }
  page += "\n## Secoes principais\n\n"
  if (sections.length === 0) {
    page += "(sem secoes H2 no arquivo fonte)\n"
  } else {
    for (const s of sections) {
      page += `### ${s.title}\n\n${s.summary || "(sem resumo)"}\n\n`
    }
  }
  planGenerated(`02-agentes/${slug}.md`, page)
}

let agentsIndex = GEN_HEADER("agents/*.md")
agentsIndex += "# Agentes\n\n"
agentsIndex += `Total: ${agentRows.length} agentes. Ver [regras do time](../../CLAUDE.md).\n\n`
agentsIndex += "| Agente | Descricao |\n|---|---|\n"
for (const a of agentRows.sort((x, y) => x.slug.localeCompare(y.slug))) {
  const desc = a.description.replace(/\|/g, "\\|").slice(0, 160)
  agentsIndex += `| [${a.slug}](${a.slug}.md) | ${desc} |\n`
}
planGenerated("02-agentes/README.md", agentsIndex)

// ---------------------------------------------------------------------------
// 2) Skills: 03-skills/README.md espelhando references/skill-agent-map.md
// ---------------------------------------------------------------------------
const skillMapPath = join(ROOT, "references", "skill-agent-map.md")
const skillMapRaw = readFileSync(skillMapPath, "utf8")

let skillsPage = GEN_HEADER("references/skill-agent-map.md")
skillsPage += "# Skills\n\n"
skillsPage += `Espelho do catalogo canonico. Fonte completa: [\`references/skill-agent-map.md\`](../../references/skill-agent-map.md).\n\n`
skillsPage += `Total no disco: ${skillSlugs.length} pastas com \`SKILL.md\`.\n\n`
skillsPage += sanitizeSkillMapBody(skillMapRaw)
planGenerated("03-skills/README.md", skillsPage)

function sanitizeSkillMapBody(raw) {
  // Remove o H1 original (viramos H1 proprio acima) e mantem o resto (H2 por familia + tabelas)
  const withoutTitle = raw.replace(/^# .+\n/, "")
  return withoutTitle
}

// ---------------------------------------------------------------------------
// 3) Integracoes: 05-integracoes.md (gerado a partir de .env.local.example + manual)
// ---------------------------------------------------------------------------
const envPath = join(ROOT, ".env.local.example")
const envRaw = readFileSync(envPath, "utf8").replace(/\r\n/g, "\n")

function groupEnvVars(text) {
  // Cabecalho de secao no formato "# --- Nome (nota obrigatorio/opcional) ---"
  const groups = []
  let current = null
  for (const line of text.split("\n")) {
    const headerMatch = line.match(/^#\s*-{2,}\s*(.+?)\s*-{2,}\s*$/)
    if (headerMatch) {
      const full = headerMatch[1].trim()
      const titleMatch = full.match(/^(.+?)\s*\((.+)\)$/)
      current = {
        title: titleMatch ? titleMatch[1].trim() : full,
        note: titleMatch ? titleMatch[2].trim() : "",
        vars: [],
      }
      groups.push(current)
      continue
    }
    const varMatch = line.match(/^([A-Z0-9_]+)=/)
    if (varMatch && current) current.vars.push(varMatch[1])
  }
  return groups.filter((g) => g.vars.length)
}

const envGroups = groupEnvVars(envRaw)
let integracoesGen = "### Variaveis por integracao (gerado)\n\n"
integracoesGen += "| Integracao | Nota | Variaveis de ambiente |\n|---|---|---|\n"
for (const g of envGroups) {
  integracoesGen += `| ${g.title} | ${g.note} | ${g.vars.map((v) => `\`${v}\``).join(", ")} |\n`
}
integracoesGen += `\nFonte: \`.env.local.example\` (${envGroups.length} integracoes mapeadas). Nenhum valor real e copiado aqui, so nome de variavel.\n`

planManaged(
  "05-integracoes.md",
  integracoesGen,
  (block) => `# Integracoes

Cada integracao abaixo habilita uma funcao do framework. A coluna "Nota" diz se
e obrigatoria ou opcional e pra que serve. Preencher a variavel correspondente
em \`.env.local\` (nunca commitar esse arquivo).

<!-- WIKI:GERADO:START -->
${block}
<!-- WIKI:GERADO:END -->
`
)

// ---------------------------------------------------------------------------
// 4) Regras e governanca: 07-regras-e-governanca.md (manual)
// ---------------------------------------------------------------------------
planManual(
  "07-regras-e-governanca.md",
  `# Regras e governanca

## Regras de cada marca

Pedidos permanentes e correcoes de cada marca ficam em
\`clients/{slug}/regras-cliente.md\` (modelo em \`clients/_template/regras-cliente.md\`).
Regra marcada \`[REINCIDENTE]\` ja se repetiu antes: conferir explicitamente
antes de agir. Como uma correcao vira regra: \`docs/LOOP-DE-APRENDIZADO.md\`.

## Status de evidencia do viral-playbook

Toda regra de \`references/viral-playbook.md\` carrega um selo:

| Status | Significa |
|---|---|
| \`[MEDIDO]\` | Tem dado real das contas da marca, com numero e fonte |
| \`[MECANICA]\` | Decorre de como a plataforma funciona, verificavel na propria UI/doc |
| \`[HIPOTESE]\` | Veio de fonte externa ou opiniao, ainda sem validacao nas contas da marca |

Regra sem selo e invalida, nao seguir.

## Regra do link publicado (publish_url)

Toda peca publicada precisa entrar no registro (\`ct_content_items\`) com o link
real (\`publish_url\`). Sem isso a peca nao cruza com a metrica dela
(\`ct_metrics_snapshots\`) e some do cockpit e do aprendizado dos agentes.
Conferir com \`npm run check:join\`.
`
)

// ---------------------------------------------------------------------------
// 5) Arquitetura: 01-arquitetura.md (manual + numeros gerados)
// ---------------------------------------------------------------------------
const invocableSkills = skillSlugs.filter((s) => s !== "_shared")
const skillFolderCount = readdirSync(SKILLS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).length
let arqGen = "### Numeros reais (gerado)\n\n"
arqGen += `- Agentes em \`agents/\`: ${agentRows.length}\n`
arqGen += `- Pastas em \`skills/\`: ${skillFolderCount}\n`
arqGen += `- Skills invocaveis (com \`SKILL.md\`): ${invocableSkills.length}\n`

planManaged(
  "01-arquitetura.md",
  arqGen,
  (block) => `# Arquitetura em 3 camadas

O framework roda em 3 camadas:

\`\`\`mermaid
flowchart LR
    A[".md local (agents/, skills/, clients/)"] -->|npm run sync:agents / sync:skills| B[(Supabase)]
    B --> C["Painel local (Sala de Comando)"]
\`\`\`

- **Camada 1, arquivos locais**: \`agents/*.md\`, \`skills/*/SKILL.md\` e \`clients/{slug}/\`
  sao a fonte unica editavel. O Claude Code (ou Codex) le direto daqui.
- **Camada 2, Supabase**: banco com pecas, metricas, agenda e uma copia de agentes e
  skills enviada pelos scripts de sync.
- **Camada 3, painel**: a Sala de Comando (\`npm run dev\`) le do banco e dos arquivos.

<!-- WIKI:GERADO:START -->
${block}
<!-- WIKI:GERADO:END -->
`
)

// ---------------------------------------------------------------------------
// 6) Paginas manuais (so criadas se nao existirem)
// ---------------------------------------------------------------------------
planManual(
  "00-visao-geral.md",
  `# Visao geral

Content Team AI e um framework white-label local: um conjunto de agentes de IA
especializados (25 hoje) que produzem conteudo para redes sociais (Instagram,
LinkedIn, YouTube, TikTok) para uma empresa por vez. Roda no computador de quem
opera, dentro do Claude Code ou do Codex, junto com um banco Supabase e um painel local.

## Pra quem e

Dono de empresa ou profissional de marketing que quer um "time de conteudo"
feito de agentes de IA, sem depender de uma agencia. Nao precisa saber
programar para usar; precisa de alguem tecnico para instalar.

## O que NAO e

Nao e um servico hospedado. Cada empresa roda a propria copia local da pasta,
com as proprias chaves. Instalacao: \`docs/SETUP.md\`.

## O que faz, em 1 tela

\`\`\`mermaid
flowchart TD
    U[Usuario] --> D[ct-diretor]
    D --> AG[Agentes especializados]
    AG --> S[Skills: gera peca, publica, pesquisa]
    S --> B[(Supabase)]
    B --> C[Cockpit / metricas]
    C --> D
\`\`\`

O usuario pede algo ("faz um carrossel sobre X"), o \`ct-diretor\` decide qual
agente cuida disso, o agente aciona a skill certa, o resultado e registrado no
banco e vira aprendizado para a proxima peca.
`
)

planManual(
  "04-fluxos-ponta-a-ponta.md",
  `# Fluxos ponta a ponta

## a) "Publica isso" (ct-peca)

\`\`\`mermaid
flowchart LR
    I[Foto/video no inbox iCloud] --> A[Apuracao na fonte]
    A --> IG[Fecha Instagram + aprovacao]
    IG --> LI[Adapta LinkedIn]
    LI --> M[Monta e higieniza midias]
    M --> P[Preview]
    P --> AG[Agenda/publica]
    AG --> R[Registra no banco]
\`\`\`

Skill dona: \`ct-peca\`. Nunca pula o portao de aprovacao antes de publicar.

## b) Video longo do YouTube vira 5 redes

Documentado em \`docs/FLUXO-YOUTUBE-PARA-REDES.md\`. Um video longo (podcast,
aula) e cortado e adaptado para Instagram, TikTok, LinkedIn, YouTube Shorts e
X, cada peca com legenda propria da rede.

## c) Talking-head vira Reel (ct-video-editor)

Video gravado com o rosto do cliente falando e editado automaticamente: corta
silencio, adiciona legenda sincronizada palavra a palavra e alterna com tela
de produto/proposta. Padrao canonico documentado em
\`skills/ct-video-editor/SKILL.md\`.

## d) Domingo: social-intel + cockpit

Uma rotina semanal (skill \`ct-social-intel\`) varre Instagram, YouTube, LinkedIn,
TikTok, concorrentes e tendencias e atualiza o cockpit de performance da marca
(resumo opcional pelo Telegram).
`
)

planManual(
  "06-onboarding-e-white-label.md",
  `# Onboarding e white-label

## Como uma empresa nova entra no kit

Jeito facil: abrir a pasta no Claude Code ou Codex e dizer "configurar empresa nova"
(skill \`ct-onboarding\`). Jeito manual:

1. Instalar conforme \`docs/SETUP.md\`.
2. Copiar \`clients/_template/\` para \`clients/{slug-da-empresa}/\`.
3. Preencher \`brand-profile.md\`, \`design-system.md\`, \`competitors.md\`.
4. Criar o arquivo \`.workspace\` apontando pro slug e rodar \`npm run workspace:boot\`.

Detalhe completo: \`docs/SETUP.md\`.

## Precedencia de configuracao

Quando duas fontes dizem coisas diferentes sobre o mesmo assunto, vence a mais
especifica:

\`\`\`mermaid
flowchart TD
    A[clients/{slug}/brand-profile.md] --> B[clients/{slug}/design-system.md]
    B --> C[references/viral-playbook.md]
    C --> D[Demais references genericas]
\`\`\`

Regra do cliente sempre manda sobre regra generica do framework.
`
)

planManual(
  "08-glossario.md",
  `# Glossario

Termos usados no dia a dia deste framework, em linguagem simples.

- **Agente**: um "funcionario" de IA especializado numa funcao (escrever,
  desenhar carrossel, pesquisar concorrente etc).
- **Skill**: uma "receita" que um agente segue para executar uma tarefa
  especifica, passo a passo.
- **Slug**: um apelido curto e sem espaco/acento pra identificar algo (uma
  empresa, uma peca de conteudo) em pastas e no banco de dados.
- **Workspace**: a pasta local que define qual empresa (cliente) esta ativa
  nesta sessao de trabalho.
- **Cliente ativo**: a empresa cujo conteudo esta sendo produzido agora.
- **Cockpit**: painel com o resumo de como o conteudo publicado esta
  performando (curtidas, alcance, comentarios).
- **Hook**: a primeira frase ou cena de uma peca, feita pra prender atencao.
- **Reel**: video curto vertical do Instagram.
- **Story**: publicacao temporaria (24h) do Instagram.
- **Carrossel**: post do Instagram com varias imagens deslizaveis.
- **publish_url**: o link real de onde a peca foi publicada, guardado no banco.
- **Snapshot**: uma "foto" dos numeros de uma peca (curtidas, views) num
  momento especifico.
- **Brand-profile**: documento com a identidade e tom de voz de uma empresa.
- **Design system**: documento com cores, fontes e estilo visual de uma empresa.
- **MCP**: um jeito padrao de uma IA se conectar a uma ferramenta externa
  (banco de dados, navegador, etc).
- **VPS**: um computador alugado na nuvem que fica ligado o tempo todo.
- **Supabase**: o banco de dados e servico de autenticacao usado pelo framework.
- **Playwright**: ferramenta que controla um navegador automaticamente (usada
  pra publicar ou raspar dados de sites sem API oficial).
- **WhisperX**: ferramenta que transcreve audio em texto com o tempo exato de
  cada palavra, usada pra legenda automatica.
- **Remotion**: ferramenta que gera video programando em vez de editar na mao.
- **ai-memory**: sistema de memoria de longo prazo entre sessoes de IA.
- **Frontmatter**: o bloco de configuracao no topo de um arquivo \`.md\`
  (entre \`---\`), com nome, descricao e outras propriedades.
- **Delegar**: quando um agente passa uma tarefa pra outro agente mais
  especializado nela.
- **Aprovacao**: o "pode" explicito de quem aprova o conteudo antes de publicar algo.
- **Cross-post**: publicar o mesmo conteudo adaptado em varias redes no mesmo dia.
- **Fonte unica**: o unico lugar onde uma informacao deve ser editada; todo o
  resto e copia/gerado a partir dela.
`
)

// ---------------------------------------------------------------------------
// 7) README.md do wiki (indice geral, gerado)
// ---------------------------------------------------------------------------
function titleOf(absPath, fallback) {
  if (!existsSync(absPath)) return fallback
  const raw = readFileSync(absPath, "utf8")
  const m = raw.match(/^#\s+(.+)$/m)
  return m ? m[1].trim() : fallback
}

const indexEntries = [
  ["00-visao-geral.md", "Visao geral"],
  ["01-arquitetura.md", "Arquitetura em 3 camadas"],
  ["02-agentes/README.md", "Agentes"],
  ["03-skills/README.md", "Skills"],
  ["04-fluxos-ponta-a-ponta.md", "Fluxos ponta a ponta"],
  ["05-integracoes.md", "Integracoes"],
  ["06-onboarding-e-white-label.md", "Onboarding e white-label"],
  ["07-regras-e-governanca.md", "Regras e governanca"],
  ["08-glossario.md", "Glossario"],
]

let readme = GEN_HEADER("wiki/*")
readme += "# Wiki do Content Team AI\n\n"
readme += "Navegue pelas paginas abaixo. Cada uma tem link pra fonte original quando aplicavel.\n\n"
for (const [rel, fallback] of indexEntries) {
  readme += `- [${titleOf(join(WIKI, rel), fallback)}](${rel})\n`
}
readme += `\n## Agentes (${agentRows.length})\n\n`
for (const a of agentRows.sort((x, y) => x.slug.localeCompare(y.slug))) {
  readme += `- [${a.slug}](02-agentes/${a.slug}.md)\n`
}
planGenerated("README.md", readme)

// ---------------------------------------------------------------------------
// Escrita / checagem
// ---------------------------------------------------------------------------
let outOfDate = []
let written = 0

for (const item of pending) {
  if (item.skipWrite) {
    if (item.markerMissing) outOfDate.push(item.path + " (marcadores WIKI:GERADO ausentes)")
    continue
  }
  const dir = dirname(item.path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  if (existsSync(item.path)) {
    const current = readFileSync(item.path, "utf8")
    if (current === item.content) continue
    outOfDate.push(item.path)
  } else {
    outOfDate.push(item.path)
  }
  if (!CHECK) {
    writeFileSync(item.path, item.content, "utf8")
    written++
  }
}

let createdManual = 0
for (const item of manualSkeletons) {
  if (existsSync(item.path)) continue
  outOfDate.push(item.path + " (manual ausente)")
  if (!CHECK) {
    const dir = dirname(item.path)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(item.path, item.content, "utf8")
    createdManual++
  }
}

if (CHECK) {
  if (outOfDate.length) {
    console.error(`wiki desatualizada (${outOfDate.length} arquivo(s)):`)
    for (const p of outOfDate) console.error(`  - ${p}`)
    process.exit(1)
  }
  console.log("wiki OK, nada desatualizado.")
} else {
  console.log(`gen-wiki: ${written} arquivo(s) gerado(s) atualizados, ${createdManual} pagina(s) manual(is) criada(s).`)
}
