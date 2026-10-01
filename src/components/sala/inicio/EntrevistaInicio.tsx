"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { validarMensagemEntrevista } from "@/lib/sala/entrevista"
import type { BlocoOnboarding } from "@/lib/sala/types"

type Respostas = Record<string, string | string[] | null>
type Mensagem = { papel: "voce" | "assistente"; texto: string }

export function EntrevistaInicio({ cliente }: { cliente: string }) {
  const [blocos, setBlocos] = useState<BlocoOnboarding[]>([])
  const [atual, setAtual] = useState(0)
  const [rascunhos, setRascunhos] = useState<Record<number, Respostas>>({})
  const [historico, setHistorico] = useState<Record<number, Mensagem[]>>({})
  const [texto, setTexto] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState("")
  const [aviso, setAviso] = useState("")

  async function carregar() {
    try {
      const r = await fetch("/api/sala/onboarding", { cache: "no-store" })
      const d = await r.json()
      if (!r.ok) throw new Error()
      setBlocos(d.blocos)
      setRascunhos(Object.fromEntries((d.blocos as BlocoOnboarding[]).map(b => [b.numero, Object.fromEntries(b.perguntas.map(p => [p.id, p.resposta ?? null]))])))
      setErro("")
    } catch { setErro("Não foi possível carregar seus dados. Tente recarregar.") }
  }
  useEffect(() => { carregar() }, [cliente])
  useEffect(() => {
    const avisar = () => setErro("A identidade visual foi atualizada. Recarregue os dados salvos antes de editar esse tema; os rascunhos desta conversa serão substituídos.")
    window.addEventListener("sala-onboarding-atualizado", avisar)
    return () => window.removeEventListener("sala-onboarding-atualizado", avisar)
  }, [])
  const bloco = blocos.find(b => b.numero === atual)
  const respostas = rascunhos[atual] ?? {}
  const mensagens = historico[atual] ?? []

  async function enviar() {
    if (!bloco || ocupado) return
    let mensagem: string
    try { mensagem = validarMensagemEntrevista(texto) }
    catch (e) { setErro(e instanceof Error && /cofre/.test(e.message) ? e.message : "Escreva uma mensagem de até 6.000 caracteres."); return }
    setOcupado(true); setErro(""); setAviso("")
    try {
      const r = await fetch("/api/sala/entrevista", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cliente, bloco: atual, mensagem, respostas }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.erro)
      setHistorico(h => ({ ...h, [atual]: [...(h[atual] ?? []), { papel: "voce", texto: mensagem }, { papel: "assistente", texto: d.mensagem }] }))
      setRascunhos(r => ({ ...r, [atual]: { ...r[atual], ...d.respostas } }))
      setTexto("")
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao conversar com a IA.") }
    finally { setOcupado(false) }
  }

  async function salvar() {
    if (!bloco || ocupado) return
    setOcupado(true); setErro(""); setAviso("")
    try {
      const r = await fetch(`/api/sala/onboarding/${atual}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cliente, respostas, hash: bloco.baseHash }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.erro)
      const salvo = d.bloco as BlocoOnboarding
      setBlocos(bs => bs.map(b => b.numero === atual ? salvo : b.arquivoDestino === bloco.arquivoDestino ? { ...b, baseHash: salvo.baseHash } : b))
      setAviso(`Dados de ${bloco.titulo.toLowerCase()} salvos. Pode continuar para o próximo tema.`)
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar.") }
    finally { setOcupado(false) }
  }

  return <section className="space-y-4 rounded-md border border-border bg-surface p-4 sm:p-6" data-testid="inicio-entrevista">
    <div><p className="text-xs font-medium uppercase tracking-wide text-accent">Configuração acompanhada</p><h2 className="mt-1 text-xl font-semibold text-text-primary">Vamos preparar sua equipe de conteúdo</h2><p className="mt-2 max-w-3xl text-sm text-text-secondary">Converse sobre a marca, confira o que a IA entendeu e salve cada tema. A conversa usa a OpenAI configurada no cofre. Senhas e chaves ficam nos campos protegidos das integrações.</p></div>
    <div className="flex flex-wrap gap-2" aria-label="Temas da entrevista">{blocos.map(b => <button key={b.numero} type="button" disabled={ocupado} aria-pressed={atual === b.numero} onClick={() => { setAtual(b.numero); setErro(""); setAviso(""); setTexto("") }} className={`rounded-full border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${atual === b.numero ? "border-accent bg-accent/10 text-text-primary" : "border-border text-text-secondary hover:bg-surface-hover"}`}>{b.titulo}{b.gravado ? " · salvo" : ""}</button>)}</div>
    {!bloco ? <p role="status">Carregando os dados da marca...</p> : <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <div role="log" aria-label="Conversa de configuração" aria-live="polite" className="max-h-96 space-y-3 overflow-y-auto rounded-md bg-surface-hover p-4">
          <div className="space-y-1"><p className="text-xs font-semibold text-accent">Assistente</p><p className="whitespace-pre-wrap text-sm text-text-primary">{atual === 7 ? "Vamos conectar suas ferramentas. Veja todas as integrações logo abaixo: cada uma explica para que serve, o que falta e como autorizar. O login acontece no site oficial. Por qual você quer começar?" : `Vamos falar sobre ${bloco.titulo.toLowerCase()}. ${Object.values(respostas).some(v => Array.isArray(v) ? v.length : v) ? "Já encontrei informações nos seus arquivos. Confira o resumo e conte o que quer completar ou mudar." : bloco.perguntas.find(p => p.tipo !== "arquivo")?.texto}`}</p></div>
          {mensagens.map((m, i) => <div key={i} className={`rounded-md border border-border p-3 ${m.papel === "voce" ? "bg-surface" : "bg-accent/5"}`}><p className="mb-1 text-xs font-semibold text-text-secondary">{m.papel === "voce" ? "Você" : "Assistente"}</p><p className="whitespace-pre-wrap break-words text-sm text-text-primary">{m.texto}</p></div>)}
        </div>
        <label htmlFor="mensagem-entrevista" className="block text-sm font-medium">Sua mensagem</label>
        <textarea id="mensagem-entrevista" value={texto} disabled={ocupado} maxLength={6000} onChange={e => setTexto(e.target.value)} className="min-h-28 w-full rounded-md border border-border bg-surface p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" placeholder="Por exemplo: meu público são arquitetos que querem organizar o escritório." />
        <Button onClick={enviar} disabled={ocupado || !texto.trim()}>{ocupado ? "Aguarde..." : "Enviar para a IA"}</Button>
        <p className="text-xs text-text-secondary">Ao enviar, a mensagem e o resumo deste tema são compartilhados com a OpenAI. Nada é publicado e nenhuma resposta é salva sem sua confirmação.</p>
      </div>
      <div className="min-w-0 space-y-3"><h3 className="font-semibold text-text-primary">O que vai ficar salvo</h3><p className="text-xs text-text-secondary">Confira e ajuste antes de salvar. Informações em branco continuam pendentes.</p>
        <div className="max-h-[440px] space-y-3 overflow-y-auto pr-1">{bloco.perguntas.filter(p => p.tipo !== "arquivo").map(p => <div key={p.id}>
          <label htmlFor={`entrevista-${p.id}`} className="mb-1 block text-sm font-medium">{p.texto}{Array.isArray(respostas[p.id]) ? ` (${(respostas[p.id] as string[]).length})` : ""}</label>
          {p.tipo === "multipla" ? <div className="flex flex-wrap gap-2">{p.opcoes?.map(opcao => { const selecionadas = Array.isArray(respostas[p.id]) ? respostas[p.id] as string[] : respostas[p.id] ? [respostas[p.id] as string] : []; return <label key={opcao} className="flex items-center gap-1 text-sm"><input type="checkbox" disabled={ocupado} checked={selecionadas.includes(opcao)} onChange={e => setRascunhos(r => ({ ...r, [atual]: { ...r[atual], [p.id]: e.target.checked ? [...selecionadas, opcao] : selecionadas.filter(v => v !== opcao) } }))} />{opcao}</label> })}</div> : <textarea id={`entrevista-${p.id}`} disabled={ocupado} value={Array.isArray(respostas[p.id]) ? (respostas[p.id] as string[]).join("\n") : respostas[p.id] ?? ""} onChange={e => setRascunhos(r => ({ ...r, [atual]: { ...r[atual], [p.id]: p.tipo === "lista" ? e.target.value.split("\n").filter(Boolean) : e.target.value } }))} className="min-h-20 w-full rounded-md border border-border bg-surface p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" />}
        </div>)}</div>
        {atual === 5 && <p className="text-sm text-text-secondary">A imagem da marca pode ser trocada no cartão Logo e identidade, acima.</p>}
        <Button onClick={salvar} disabled={ocupado} variant="outline">Confirmar e salvar {bloco.titulo.toLowerCase()}</Button>
      </div>
    </div>}
    {erro && <div role="alert" className="space-y-2 text-sm text-error"><p>{erro}</p><Button variant="outline" size="sm" disabled={ocupado} onClick={carregar}>Recarregar dados salvos</Button></div>}
    {aviso && <p role="status" className="text-sm text-success">{aviso}</p>}
  </section>
}
