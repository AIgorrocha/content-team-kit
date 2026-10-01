// Contrato de dados da Sala de Comando (v2). Fonte unica de verdade: todo componente e
// toda rota da Sala usam so os tipos e a interface `SalaData` daqui. Ver
// docs/superpowers/plans/2026-09-11-sala-de-comando-fase1-front.md, secao "Contrato de dados".
export type Rede = "instagram" | "linkedin" | "youtube" | "tiktok" | "x" | "meta_ads" | "email"
export type TipoPeca = "reel" | "reel_faceless" | "carrossel" | "story" | "post_linkedin" | "youtube_longo" | "recorte" | "capa" | "email"
export type Etapa = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export const ETAPAS: Record<Etapa, string> = {
  1: "Entrada", 2: "Apuração", 3: "Texto Instagram", 4: "LinkedIn", 5: "Mídia e QA", 6: "Drive", 7: "Publicar", 8: "Registrado",
}
export type StatusEtapa = "pendente" | "em_andamento" | "aguardando_aprovacao" | "aprovado" | "ajuste" | "concluido"

export interface Artefato {
  id: string
  tipo: "capa" | "slide" | "story" | "thumbnail" | "clip" | "video" | "fluxograma" | "legenda_ig" | "legenda_tiktok" | "shorts" | "post_linkedin" | "roteiro" | "qa" | "titulo" | "descricao" | "tags"
  nome: string
  url: string | null          // /sala-mock/... na Fase 1, /api/sala/asset?... na Fase 2
  poster?: string | null
  texto?: string | null       // conteudo de .txt e .md
  versao?: string             // "v9", "FINAL-v2"
  aprovado?: boolean          // qual versao foi ao ar
}

export interface Revisao {
  id: string                    // "melhor-fluxo-videochamada:r9"
  numero: number                // 1..n, nunca sobrescrita
  criadaEm: string
  criadaPor: string             // agente ou o dono da conta (Configuracao.kit.dono, minusculo)
  artefatoIds: string[]
  oQueMudou: string
  aprovadaEm: string | null     // preenchido quando uma aprovacao apontou pra ela
}

export interface EstadoEtapa {
  etapa: Etapa
  status: StatusEtapa | "nao_se_aplica"
  rede: Rede | null             // etapas 3, 4 e 7 sao por rede
  revisaoId: string | null      // aprovacao SEMPRE aponta pra uma revisao
  dono: string | null           // slug do agente
  aprovadoEm: string | null
  aprovadoPor: string | null
  motivoAjuste: string | null
}

export interface Peca {
  slug: string                  // identidade = pasta content/{cliente}/{formato}/{slug}
  titulo: string
  tipo: TipoPeca
  cliente: string
  redes: Rede[]
  etapaAtual: Etapa
  statusEtapa: StatusEtapa
  etapas: EstadoEtapa[]         // uma por etapa (e por rede nas etapas 3, 4 e 7)
  donoEtapa: string            // slug do agente
  diasParado: number
  capaUrl: string | null
  artefatos: Artefato[]
  revisoes: Revisao[]
  pecaMae?: string | null       // parent_slug (youtube_longo de origem)
  publicacoes: Publicacao[]
  pendenciasHumanas: string[]   // "TikTok em análise", "aguardando gravação"
  criadoEm: string
  atualizadoEm: string
}

export const FUSO = "America/Sao_Paulo"
export const RELOGIO_MOCK = "2026-09-11T15:00:00-03:00"  // "agora" fixo do mock; live usa Date.now()

export interface Publicacao {
  rede: Rede
  url: string | null
  publicadoEm: string | null
  agendadoPara: string | null
  status: "rascunho" | "agendado" | "publicado" | "em_analise" | "falhou"
  metricas?: { views?: number; likes?: number; comentarios?: number; salvos?: number; compartilhamentos?: number }
  automacaoComentario?: { ativa: boolean; palavra?: string; cadastrada?: boolean }
}

export type StatusAgente = "parado" | "trabalhando" | "erro"
export interface Agente {
  slug: string                  // ct-redator
  nome: string                  // Redator
  funcao: string                // frontmatter description
  familia: "base" | "bridge" | "ads"
  status: StatusAgente
  tarefaAtual: string | null
  ultimaAtividade: string | null
  promptMd: string              // conteudo do agents/{slug}.md
  promptHash: string            // sha256 do promptMd carregado
  contexto: string[]            // arquivos que carrega: brand-profile, design-system, regras, playbook
  skills: string[]              // de references/skill-agent-map.md
  memoriaRecente: { titulo: string; caminho: string; data: string }[]
  ultimasPecas: string[]        // slugs
}

export type EventoTipo = "pedido" | "diretor_planejou" | "agente_iniciou" | "agente_ferramenta" | "agente_concluiu" | "aprovacao_pedida" | "aprovado" | "ajuste_pedido" | "publicado" | "registrado" | "erro"
export type FamiliaAgente = "claude" | "codex" | "grok" | "kimi"
export interface EventoAoVivo {
  id: string
  ts: string
  caixa: 1 | 2 | 3 | 4 | 5 | 6  // dono pede, Diretor, Especialistas, dono aprova, Publica, Fica registrado
  tipo: EventoTipo
  agente: string | null
  peca: string | null
  ferramenta?: string | null
  resumo: string
  origem: "site" | "terminal"
  // familia/modelo (Batelada B3, gravados pelo hook-forward.mjs da Batelada B7): quem
  // rodou o agente (Claude, Codex, Grok, Kimi) e o modelo. Evento antigo sem os dois
  // fica ausente/null e o cartao de Trabalho mostra sem esse detalhe.
  familia?: FamiliaAgente | null
  modelo?: string | null
}

export interface Conexao {
  id: string                    // instagram, linkedin, youtube, tiktok, meta_ads, supabase, ai_memory, vps, telegram, higgsfield, mcp:<nome>
  nome: string
  categoria: "rede" | "infra" | "mcp"
  status: "ok" | "vencendo" | "vencida" | "sessao" | "desconhecida" | "desligada"
  conectadoEm: string | null
  expiraEm: string | null
  diasRestantes: number | null
  renovacao: "automatica" | "manual" | "sessao" | "nao_expira"
  ultimoUso: string | null
  conta: string | null          // @sua_empresa
  acao: "conectar" | "renovar" | "testar" | "copiar_trecho" | null
  trechoConfig?: string | null  // MCP: snippet pronto
  detalhe?: string | null
}

export type Selo = "FIXA" | "REINCIDENTE" | "HIPOTESE" | "MEDIDO" | "MECANICA"
export interface Regra {
  id: string
  tipoConteudo: TipoPeca | "geral"
  selo: Selo
  titulo: string
  texto: string
  arquivo: string               // clients/{slug}/regras-cliente.md (ou outro .md configurado no seed do cliente)
  atualizadoEm: string | null
  hash: string                  // sha256 do arquivo de origem
}
export interface Aprendizado { data: string; peca: string; texto: string; fonte: string }
// rede (Batelada B5): inferida pelos provedores a partir do tipoConteudo (ver
// fontes/padroes.ts, funcao redeDoTipo), pra "Capas aprovadas" de /sala/redes filtrar por
// rede sem repetir a logica em cada provedor.
export interface PadraoVisual { tipoConteudo: TipoPeca; rede: Rede | null; titulo: string; regras: string[]; exemplos: { peca: string; url: string }[]; arquivo: string }

export interface ItemCalendario {
  id: string
  peca: string
  titulo: string
  tipo: TipoPeca
  rede: Rede | null
  estado: "planejado" | "agendado" | "publicado"
  data: string                  // ISO
  url: string | null
  origem?: "sala" | "api" | "manual"  // pendencia de outra batelada (B6): quem gravou a linha
}

export interface ResumoRede {
  rede: Rede
  conta: string | null
  estadoConta: "ok" | "atencao" | "desligada"
  ultimosPosts: { peca: string; titulo: string; url: string | null; publicadoEm: string; capaUrl: string | null; metricas?: Publicacao["metricas"] }[]
  melhorHorario: string | null
  automacao: { tipo: "ig_webhook" | "yt_responder" | "nenhuma"; regras: { palavra: string; link: string }[]; videosMonitorados?: string[] }
}

export interface VisaoGeral {
  emProducao: { etapa: Etapa; quantidade: number }[]
  aguardandoAprovacao: Peca[]
  programados: ItemCalendario[]
  publicadosSemana: Publicacao[]
  alertas: { nivel: "info" | "atencao" | "critico"; texto: string; link: string }[]
  ritmo: { semana: string; pecasPublicadas: number; pecasTocadas: number }[]
}

export interface Configuracao {
  banco: { modo: "local" | "nuvem"; url: string; ok: boolean; editavel?: boolean }
  modelos: { familia: "claude" | "codex" | "grok"; condutor: string; subagente: string | null; esforco: string }[]
  chaves: { nome: string; presente: boolean }[]
  // kit.dono: contrato v2 addendum (Tarefa 16). Nome do dono da conta pra exibir nas
  // caixas 1 e 4 do mapa (/sala/ao-vivo). Vem de clients/{slug}/sala-mock/seed.json
  // (campo "dono") quando o cliente tiver um seed pessoal; "Você" no cenário genérico.
  kit: { versao: string; cliente: string; exportadoEm: string | null; dono: string }
}

export interface BlocoOnboarding {
  numero: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
  titulo: string
  perguntas: { id: string; texto: string; tipo: "texto" | "multipla" | "arquivo" | "lista"; opcoes?: string[]; resposta?: string | string[] | null }[]
  resumo: string | null
  gravado: boolean
  arquivoDestino: string
  baseHash?: string              // sha256 do arquivoDestino no live (ausente no mock e se o arquivo ainda não existe)
  // origem (Batelada B9): "arquivo" quando a resposta não foi gravada pela Sala e veio de
  // pré-preenchimento derivado dos arquivos manuais do cliente (brand-profile.md etc, ver
  // src/lib/sala/fontes/onboarding-inferir.ts). Ausente quando gravado pela Sala ou sem
  // nenhuma resposta derivável.
  origem?: "arquivo"
}

export class ConflitoEdicao extends Error {
  constructor(public atual: string, public hashAtual: string) { super("conflito: o arquivo mudou desde que foi carregado") }
}

export interface Aprovacao { etapa: Etapa; rede: Rede | null; revisaoId: string; acao: "aprovar" | "ajuste"; motivo?: string }

// Kanban de Trabalho (Batelada B3): substitui Ao vivo e Time por um quadro só, "quem
// está fazendo o quê agora". Uma coluna por estado, um cartão por agente.
export type ColunaTrabalhoId = "esperando" | "trabalhando" | "aguardando_aprovacao" | "concluido_hoje"
export interface CartaoTrabalho {
  agente: string                    // slug, ex: ct-redator
  apelido: string                   // nome de exibicao, ex: Redator
  familia: FamiliaAgente | null
  modelo: string | null
  tarefa: string | null
  desde: string | null              // ISO da ultima atividade conhecida do agente
  pecas: string[]                   // slugs das ultimas pecas tocadas
}
export interface ColunaTrabalho { id: ColunaTrabalhoId; agentes: CartaoTrabalho[] }

export interface SalaData {
  agora(): string                                        // RELOGIO_MOCK no mock, Date.now() no live
  // Cliente ativo da Sala (Batelada B1). Live: cookie sala_cliente > .workspace/CT_CLIENT;
  // disponiveis = pastas de clients/ com brand-profile.md. Mock: sempre o cliente do seed,
  // disponiveis com so ele.
  clienteAtivo(): Promise<{ slug: string; nome: string; disponiveis: { slug: string; nome: string }[] }>
  escolherCliente(slug: string): Promise<void>            // lanca erro se slug nao estiver em disponiveis
  visaoGeral(): Promise<VisaoGeral>
  pecas(): Promise<Peca[]>
  peca(slug: string): Promise<Peca | null>
  aprovar(slug: string, aprovacao: Aprovacao): Promise<Peca>   // muda o EstadoEtapa (etapa, rede) apontando pra revisaoId; "ajuste" exige motivo
  criarFilho(slugMae: string, tipo: TipoPeca, rede: Rede | null): Promise<Peca>
  agentes(): Promise<Agente[]>
  agente(slug: string): Promise<Agente | null>            // Agente.promptHash = sha256 do promptMd carregado
  trabalho(): Promise<{ colunas: ColunaTrabalho[] }>       // kanban de /sala/trabalho, ver ColunaTrabalho
  salvarPrompt(slug: string, promptMd: string, baseHash: string): Promise<{ ok: true; hash: string; sincronizado: boolean }>  // lanca ConflitoEdicao (rota responde 409 com {atual, hashAtual})
  eventosRecentes(limite?: number): Promise<EventoAoVivo[]>
  assinarEventos(): AsyncIterable<EventoAoVivo>          // mock: reproduz o roteiro do seed em loop; live: Realtime
  trilha(slugMae: string): Promise<{ mae: Peca; filhos: Peca[] }>
  calendario(inicio: string, fim: string): Promise<ItemCalendario[]>   // inclui planejados, agendados E publicados
  reprogramar(id: string, novaData: string): Promise<ItemCalendario>   // preserva a hora se novaData vier so com a data
  redes(): Promise<ResumoRede[]>
  regras(): Promise<Regra[]>                              // Regra.hash = sha256 do arquivo de origem
  salvarRegra(id: string, texto: string, selo: Selo, baseHash: string): Promise<Regra>  // lanca ConflitoEdicao
  padroes(): Promise<PadraoVisual[]>
  aprendizados(): Promise<Aprendizado[]>
  conexoes(): Promise<Conexao[]>
  acaoConexao(id: string, acao: NonNullable<Conexao["acao"]>): Promise<Conexao | { redirect: string }>  // conectar/renovar das redes com OAuth devolve redirect pro fluxo /api/sala/oauth/{rede}
  configuracao(): Promise<Configuracao>
  alterarConfiguracao(parte: "banco" | "modelos", valor: unknown): Promise<Configuracao>
  onboarding(): Promise<BlocoOnboarding[]>
  gravarBloco(numero: number, respostas: Record<string, unknown>, baseHash?: string): Promise<BlocoOnboarding>  // live exige baseHash (sha256 hex64) e lanca ConflitoEdicao
  reset(): Promise<void>                                  // mock: recria o seed; live: no-op
}
