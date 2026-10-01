// Estado mutável compartilhado do provedor mock da Sala de Comando. Um único módulo
// Node mantém isto em memória do processo (Global Constraints: nunca grava em ct_* nem em
// .md do repo nesta fase). `reset()` (POST /api/sala/mock/reset) recria tudo do zero.
import { construirSeed, type CenarioSeed, type EstadoSala } from "./seed"
import { RELOGIO_MOCK } from "@/lib/sala/types"

// Next carrega o modulo em bundles separados para rotas e paginas, e o recarrega no
// modo dev. O estado precisa pertencer ao processo para o reset atingir ambos.
const processo = globalThis as typeof globalThis & {
  __salaMockEstado?: { promessa: Promise<EstadoSala> | null; cenario: CenarioSeed }
}
const estado = processo.__salaMockEstado ??= { promessa: null, cenario: "padrao" }
// Cenário do mock ("padrao" = seed.json do cliente ativo se existir; "vazio" = cenário
// genérico mesmo que o seed.json exista). Só o reset (POST /api/sala/mock/reset?cenario=)
// troca isto; ver Tarefa 14, teste tests/sala/vazio.spec.ts.

function iniciar(): Promise<EstadoSala> {
  if (!estado.promessa) estado.promessa = construirSeed(estado.cenario)
  return estado.promessa
}

// Toda rota/metodo do mock que precisa ler ou mutar dado passa por aqui.
export async function obterEstado(): Promise<EstadoSala> {
  return iniciar()
}

export function definirCenario(cenario: CenarioSeed): void {
  estado.cenario = cenario
}

export async function reiniciarEstado(): Promise<void> {
  estado.promessa = construirSeed(estado.cenario)
  await estado.promessa
}

// "agora" fixo do mock (contrato v2: RELOGIO_MOCK). O provedor live usa Date.now().
export function agora(): string {
  return RELOGIO_MOCK
}
