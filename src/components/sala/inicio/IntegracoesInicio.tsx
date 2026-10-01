"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AcaoConexao } from "@/components/sala/conexoes/AcaoConexao"
import type { Conexao } from "@/lib/sala/types"

const GUIAS: Record<string, { para: string; passos: string[]; url?: string }> = {
  instagram: { para: "Consultar a conta profissional e seus conteúdos.", passos: ["Tenha uma conta profissional vinculada à Página usada no aplicativo Meta.", "Guarde o App ID e o App secret no cofre abaixo.", "Clique em Conectar, entre na Meta e autorize a conta correta. Depois use Testar."], url: "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/" },
  linkedin: { para: "Identificar a conta e verificar acesso ao LinkedIn.", passos: ["No aplicativo LinkedIn, configure o acesso OpenID Connect e o endereço de retorno desta instalação.", "Guarde Client ID e Client secret no cofre.", "Clique em Conectar, entre no LinkedIn e confirme o acesso. Publicar exige uma autorização adicional do aplicativo."], url: "https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access" },
  youtube: { para: "Consultar o canal e os vídeos publicados.", passos: ["Ative a YouTube Data API no projeto Google e configure a tela de consentimento.", "Crie um cliente OAuth para aplicativo web e guarde Client ID e Client secret no cofre.", "Clique em Conectar e escolha a conta do canal. A conexão atual solicita acesso de leitura."], url: "https://developers.google.com/youtube/v3/guides/authentication" },
  meta_ads: { para: "Consultar contas de anúncios, sem criar campanhas.", passos: ["Use o aplicativo Meta com acesso de leitura aos anúncios.", "Guarde App ID e App secret no cofre.", "Clique em Conectar e autorize a conta de anúncios desejada. Nenhum anúncio é criado aqui."], url: "https://developers.facebook.com/docs/marketing-api/get-started/" },
  tiktok: { para: "Acompanhar conteúdo pela sessão do navegador configurado.", passos: ["Abra o TikTok no navegador dedicado à automação desta instalação.", "Faça o login diretamente no site, incluindo a confirmação em duas etapas.", "A leitura depende da sessão e do coletor instalado. A Sala ainda não inicia essa automação pela tela."], url: "https://www.tiktok.com/login" },
  supabase: { para: "Guardar o estado do trabalho, publicações e o cofre criptografado.", passos: ["Inicie o banco local pelo Docker ou configure sua instalação Supabase.", "A instalação precisa de uma chave de criptografia antes de guardar credenciais.", "Use Testar para conferir se o banco responde. A configuração de banco fica em Ajustes."] },
  ai_memory: { para: "Dar aos agentes acesso às decisões e aprendizados da marca.", passos: ["Configure o servidor de memória na instalação.", "Vincule o projeto de memória ao cliente correto.", "Use Testar para verificar a resposta do servidor. A memória aparece no detalhe do agente."] },
  telegram: { para: "Receber avisos no canal ou conversa configurada.", passos: ["Crie o bot pelo BotFather no Telegram e configure o destino na instalação.", "Guarde o token fora dos arquivos versionados, na configuração protegida do servidor.", "A Sala mostra presença da configuração. Enviar uma mensagem de teste ainda é uma ação externa separada."], url: "https://core.telegram.org/bots/tutorial" },
  higgsfield: { para: "Gerar mídia quando a ferramenta estiver configurada.", passos: ["Obtenha a chave na sua conta Higgsfield.", "Configure a chave no ambiente protegido desta instalação.", "Chave presente não prova acesso nem saldo. A Sala ainda não testa uma geração pela tela."] },
  vps: { para: "Manter a Sala disponível no servidor da sua instalação.", passos: ["Confira o endereço de acesso e o serviço configurado no servidor.", "Mantenha banco e autenticação configurados antes de disponibilizar a aplicação.", "A Sala não mede automaticamente a saúde deste servidor remoto."] },
}

export function IntegracoesInicio({ cliente }: { cliente: string }) {
  const [conexoes, setConexoes] = useState<Conexao[]>([])
  const [erro, setErro] = useState("")
  useEffect(() => {
    const controle = new AbortController()
    fetch("/api/sala/conexoes", { cache: "no-store", signal: controle.signal }).then(async r => {
      const d = await r.json()
      if (!r.ok) throw new Error()
      setConexoes(d.conexoes)
    }).catch(() => { if (!controle.signal.aborted) setErro("Não foi possível consultar as conexões. Recarregue a página.") })
    return () => controle.abort()
  }, [cliente])

  return <section id="integracoes" className="space-y-4" data-testid="inicio-integracoes">
    <div><h2 className="text-xl font-semibold text-text-primary">Conecte suas ferramentas, uma por vez</h2><p className="mt-1 text-sm text-text-secondary">{conexoes.length} integrações encontradas nesta instalação. Abra o passo a passo, guarde as chaves no cofre e faça o login no site oficial.</p><p className="mt-1 text-sm text-text-secondary">Testar verifica o acesso. Não publica conteúdo e não comprova permissão para publicar.</p></div>
    {erro && <p role="alert" className="text-sm text-error">{erro}</p>}
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{conexoes.map(c => {
      const guia = GUIAS[c.id] ?? { para: "Conectar uma ferramenta aos agentes da sua instalação.", passos: ["Confira se este conector está instalado no aplicativo que executa o agente.", "Use as opções de conexão desse aplicativo para autorizar sua conta.", "Reabra a sessão para carregar a configuração. A Sala não confirma a conexão apenas por encontrar o cadastro."] }
      return <article key={c.id} className="min-w-0 space-y-3 rounded-md border border-border bg-surface p-4"><div><h3 className="font-semibold text-text-primary">{c.nome}</h3><p className="text-sm text-text-secondary">{guia.para}</p>{c.conta && <p className="mt-1 break-words text-sm text-text-primary">{c.conta}</p>}</div><AcaoConexao conexaoInicial={c} /><details className="rounded-md border border-border p-3"><summary className="cursor-pointer text-sm font-medium text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Como configurar {c.nome}</summary><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-text-secondary">{guia.passos.map(p => <li key={p}>{p}</li>)}</ol>{guia.url && <a href={guia.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-accent underline">Abrir orientação oficial</a>}</details></article>
    })}</div>
    <p className="text-sm text-text-secondary">OpenAI e Anthropic ficam no cofre abaixo. X e e-mail ainda não têm um fluxo de conexão nesta Sala. <Link href="/sala/redes" className="text-accent underline">Ver contas e publicações por rede</Link>.</p>
  </section>
}
