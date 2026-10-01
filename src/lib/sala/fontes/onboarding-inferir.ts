// Pré-preenchimento do onboarding a partir dos arquivos manuais do cliente (Batelada B9,
// causa raiz 1): o cliente real preenche brand-profile.md, design-system.md, competitors.md e
// voice-patterns.md à mão, nunca pelo assistente da Sala. Sem isto, `lerOnboardingLive` só
// mostrava resposta quando havia payload gravado pela própria Sala, e o Início ficava sempre
// vazio pra quem já tem os arquivos prontos.
//
// Best-effort e tolerante: markdown de cada cliente tem cabeçalhos e redação livres, então
// cada função aqui é uma heurística por cabeçalho/palavra-chave, nunca lança erro, e devolve
// null pra qualquer pergunta que não conseguir derivar (a tela mostra "confira e grave": é um
// rascunho revisável, não uma resposta definitiva).
import { lerArquivo } from "./arquivos"

function secaoPorTitulo(md: string, tituloRegex: RegExp): string | null {
  const linhas = md.split(/\r?\n/)
  let capturando = false
  let nivelAtual = 0
  const corpo: string[] = []
  for (const linha of linhas) {
    const cabecalho = linha.match(/^(#{1,6})\s+(.*)$/)
    if (cabecalho) {
      const nivel = cabecalho[1].length
      if (capturando) {
        if (nivel <= nivelAtual) break
      } else if (tituloRegex.test(cabecalho[2])) {
        capturando = true
        nivelAtual = nivel
      }
      continue
    }
    if (capturando) corpo.push(linha)
  }
  return capturando ? corpo.join("\n").trim() || null : null
}

function itensDeLista(corpo: string | null, max = 8): string[] {
  if (!corpo) return []
  return corpo
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/)?.[1]?.trim())
    .filter((l): l is string => !!l)
    .map((l) => l.replace(/\*\*/g, "").replace(/`/g, ""))
    .slice(0, max)
}

function primeiroParagrafo(corpo: string | null): string | null {
  if (!corpo) return null
  const paragrafo = corpo
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .find((p) => p.length > 0 && !p.startsWith("#"))
  return paragrafo ? paragrafo.replace(/\r?\n/g, " ").replace(/\*\*/g, "").trim() : null
}

function linhaComRotulo(md: string, rotuloRegex: RegExp): string | null {
  return md.match(rotuloRegex)?.[1]?.trim() ?? null
}

function juntar(...partes: (string | null)[]): string | null {
  const validas = partes.filter((p): p is string => !!p && p.length > 0)
  return validas.length > 0 ? validas.join("; ") : null
}

function inferirBloco0(cliente: string, md: string): Record<string, unknown> {
  const titulo = md.match(/^#\s+(.*)$/m)?.[1]?.replace(/^Brand Profile\s*-\s*/i, "").trim() ?? null
  const quem = primeiroParagrafo(secaoPorTitulo(md, /quem\s+[eé]\b/i))
  const nicho = primeiroParagrafo(secaoPorTitulo(md, /^nicho$/i))
  const site = linhaComRotulo(md, /\*\*Site\*\*:\s*(\S+)/i)
  return {
    nome_empresa: juntar(quem, nicho ? `Vende: ${nicho}` : null) ?? titulo,
    site,
    slug: cliente,
  }
}

function inferirBloco1(md: string): Record<string, unknown> {
  const perfil = linhaComRotulo(md, /\*\*Perfil principal:\*\*\s*([^\n]+)/i)
  const quemSao = itensDeLista(secaoPorTitulo(md, /quem\s+s[aã]o/i))
  const dores = itensDeLista(secaoPorTitulo(md, /o que n[aã]o funciona/i))
  const historico = itensDeLista(secaoPorTitulo(md, /hist[oó]rico da regra/i))
  return {
    quem_compra: juntar(perfil, quemSao.length > 0 ? quemSao.join("; ") : null),
    dores: dores.length > 0 ? dores : null,
    ja_tentou: historico.length > 0 ? historico.join(" ") : null,
  }
}

function inferirBloco2(md: string, mdVoz: string | null): Record<string, unknown> {
  const quemE = secaoPorTitulo(md, /quem\s+[eé]\b/i)
  const nomeNegrito = quemE?.match(/\*\*([^*]+)\*\*/)?.[1]?.trim() ?? null
  const frases = itensDeLista(secaoPorTitulo(md, /express[oõ]es\s+t[ií]picas/i))
  const nuncaDizer = itensDeLista(mdVoz ? secaoPorTitulo(mdVoz, /anti-?padr[oõ]es/i) : null)
  const tomBullets = itensDeLista(secaoPorTitulo(md, /^tom\s+de\s+voz$/i)).slice(0, 3)
  return {
    quem_assina: nomeNegrito,
    frases_tipicas: frases.length > 0 ? frases : null,
    nunca_dizer: nuncaDizer.length > 0 ? nuncaDizer.join("; ") : null,
    tom: tomBullets.length > 0 ? tomBullets.join("; ") : null,
  }
}

function inferirBloco3(md: string): Record<string, unknown> {
  const pilares = itensDeLista(secaoPorTitulo(md, /^pilares de conte[uú]do/i)).map((p) => p.split("—")[0].split("-")[0].trim())
  const baseline = itensDeLista(secaoPorTitulo(md, /baseline de m[eé]tricas/i)).slice(0, 4)
  const diferenciais = itensDeLista(secaoPorTitulo(md, /^diferenciais$/i))
  return {
    pilares: pilares.length > 0 ? pilares : null,
    provas: baseline.length > 0 ? baseline.join("; ") : null,
    diferenciais: diferenciais.length > 0 ? diferenciais.join("; ") : null,
  }
}

const OPCOES_REDE: Record<string, RegExp> = {
  Instagram: /instagram/i,
  LinkedIn: /linkedin/i,
  YouTube: /youtube/i,
  TikTok: /tiktok/i,
}

const OPCOES_FORMATO: Record<string, RegExp> = {
  carrossel: /carrossel/i,
  "reel com rosto": /\breel\b/i,
  "reel sem rosto": /faceless|sem rosto|moneyprinterturbo/i,
  story: /\bstor(y|ies)\b/i,
  artigo: /\bartigo\b/i,
  "YouTube longo": /youtube/i,
}

function inferirBloco4(md: string, mdDesign: string | null): Record<string, unknown> {
  const plataformas = secaoPorTitulo(md, /^plataformas/i) ?? md
  const texto = `${md}\n${mdDesign ?? ""}`
  const redesHoje = Object.entries(OPCOES_REDE).filter(([, re]) => re.test(plataformas)).map(([nome]) => nome)
  const formatos = Object.entries(OPCOES_FORMATO).filter(([, re]) => re.test(texto)).map(([nome]) => nome)
  return {
    redes_hoje: redesHoje.length > 0 ? redesHoje : null,
    formatos: formatos.length > 0 ? formatos : null,
  }
}

function inferirBloco5(md: string): Record<string, unknown> {
  const cores = secaoPorTitulo(md, /^cores$/i)
  const hexes = cores ? Array.from(cores.matchAll(/#[0-9a-f]{3,8}\b/gi)).map((m) => m[0]) : []
  const linhasCores = itensDeLista(cores).slice(0, 2)
  const fontes = itensDeLista(secaoPorTitulo(md, /^fontes$/i)).slice(0, 2)
  const assets = secaoPorTitulo(md, /assets de marca/i)
  const temFoto = assets && /avatar|foto/i.test(assets)
  return {
    cores: linhasCores.length > 0 ? linhasCores.join("; ") : hexes.length > 0 ? hexes.slice(0, 2).join(", ") : null,
    fonte: fontes.length > 0 ? fontes.join("; ") : null,
    foto: temFoto ? "Sim, ver assets de marca no design-system" : null,
  }
}

function inferirBloco6(md: string): Record<string, unknown> {
  const handles = Array.from(new Set(Array.from(md.matchAll(/@[\w.]{2,}/g)).map((m) => m[0])))
  return { perfis: handles.length > 0 ? handles : null }
}

// Ponto de entrada único: numeroBloco -> respostas parciais derivadas, ou null se o arquivo
// de origem não existe (nada pra inferir). Cada bloco lê o(s) arquivo(s) mais relevantes pra
// ele, não necessariamente só o `arquivoDestino` do template (ex.: bloco 2 é persona/voz mas
// "quem assina" e "tom" saem melhor do brand-profile.md do que de voice-patterns.md sozinho).
export function inferirRespostasBloco(cliente: string, numeroBloco: number): Record<string, unknown> | null {
  const brand = lerArquivo(`clients/${cliente}/brand-profile.md`)
  switch (numeroBloco) {
    case 0:
      return brand ? inferirBloco0(cliente, brand) : null
    case 1:
      return brand ? inferirBloco1(brand) : null
    case 2: {
      if (!brand) return null
      const voz = lerArquivo(`clients/${cliente}/voice-patterns.md`)
      return inferirBloco2(brand, voz)
    }
    case 3:
      return brand ? inferirBloco3(brand) : null
    case 4: {
      if (!brand) return null
      const design = lerArquivo(`clients/${cliente}/design-system.md`)
      return inferirBloco4(brand, design)
    }
    case 5: {
      const design = lerArquivo(`clients/${cliente}/design-system.md`)
      return design ? inferirBloco5(design) : null
    }
    case 6: {
      const competitors = lerArquivo(`clients/${cliente}/competitors.md`)
      return competitors ? inferirBloco6(competitors) : null
    }
    default:
      return null
  }
}
