// Checagem do provedor live da Sala de Comando (Tarefa A3). Roda com
// `SALA_DATA=live npx tsx scripts/sala/check-live.ts`. Só LEITURA: nunca chama nenhum método
// de escrita editorial. Imprime
// contagem por método e a taxa de casamento peça <-> publicação (heurística documentada em
// src/lib/sala/data/live/pecas.ts).
import {config} from "dotenv"
config({path:".env.local",quiet:true})

async function main() {
  const {getLive}=await import("../../src/lib/sala/data/live")
  const {lerPecasLive}=await import("../../src/lib/sala/data/live/pecas")
  const {resolverClienteAtivo}=await import("../../src/lib/sala/fontes")
  if (process.env.SALA_DATA !== "live") {
    console.warn('aviso: SALA_DATA não é "live" (defina SALA_DATA=live antes de rodar este script).')
  }

  const cliente = await resolverClienteAtivo()
  console.log(`cliente ativo: ${cliente}`)
  const sala = getLive()

  const { estatistica } = await lerPecasLive(cliente, sala.agora())
  console.log(
    `match peça<->publicação: ${estatistica.casadas}/${estatistica.totalPublicacoes} publicações casadas (${(estatistica.taxa * 100).toFixed(1)}%)`
  )

  const pecas = await sala.pecas()
  console.log(`pecas(): ${pecas.length} peça(s) de nível 1`)

  const agentes = await sala.agentes()
  console.log(`agentes(): ${agentes.length} agente(s)`)
  if (agentes.length !== 25) throw new Error(`esperado 25 agentes, veio ${agentes.length}`)

  const eventos = await sala.eventosRecentes()
  console.log(`eventosRecentes(): ${eventos.length} evento(s)`)

  const hoje = new Date().toISOString().slice(0, 10)
  const fimAno = `${new Date().getFullYear()}-12-31`
  const inicioAno = `${new Date().getFullYear()}-01-01`
  const calendario = await sala.calendario(inicioAno, fimAno)
  console.log(`calendario(${inicioAno}..${fimAno}): ${calendario.length} item(ns)`)
  console.log(`  (hoje é ${hoje}, referência)`)

  const redes = await sala.redes()
  console.log(`redes(): ${redes.length} rede(s)`)
  if (redes.length !== 7) throw new Error(`esperado 7 redes, veio ${redes.length}`)

  const regras = await sala.regras()
  console.log(`regras(): ${regras.length} regra(s)`)

  const padroes = await sala.padroes()
  console.log(`padroes(): ${padroes.length} padrão(ões)`)

  const aprendizados = await sala.aprendizados()
  console.log(`aprendizados(): ${aprendizados.length} aprendizado(s)`)

  const conexoes = await sala.conexoes()
  console.log(`conexoes(): ${conexoes.length} conexão(ões)`)
  if (conexoes.length < 10) throw new Error(`esperado >= 10 conexões, veio ${conexoes.length}`)

  const configuracao = await sala.configuracao()
  console.log(`configuracao(): banco.modo=${configuracao.banco.modo} banco.ok=${configuracao.banco.ok} kit.dono=${configuracao.kit.dono}`)

  const onboarding = await sala.onboarding()
  console.log(`onboarding(): ${onboarding.length} bloco(s)`)

  // Escritas e conflitos sao provados pelas specs live dedicadas.
  console.log("\ncheck-live: OK")
  process.exit(0)
}

main().catch((erro) => {
  console.error("check-live: FALHOU:", erro)
  process.exit(1)
})
