import { obterTema } from "@/lib/sala/tema"

// Server component: injeta as variáveis de tema do cliente ativo em `:root`, não mais
// escopado a `[data-sala]`. Motivo (achado 3 da revisão final): os portais do Radix
// Dialog (DetalhePeca) e os gráficos/nós que usam `hsl(var(--x))` inline (NoPeca) ficam
// FORA da árvore `[data-sala]` no DOM, então uma regra `[data-sala] { ... }` nunca os
// alcançava e o tema ficava parcial. Como este componente só é montado pelo layout de
// `/sala` (src/app/(dashboard)/sala/layout.tsx), a sobrescrita em :root desmonta junto
// com a Sala: navegar pra outra página do dashboard volta pros defaults de
// src/app/globals.css sem precisar re-escopar nada.
//
// Correção 2 (hydration mismatch, reportado pela Tarefa 3 em /sala e /sala/inicio):
// `<style>` é elemento de "raw text" no HTML (como `<script>`), então o navegador NUNCA
// decodifica entidade dentro dele. Com o CSS como filho de texto do JSX, o React escapa
// aspas simples pra `&#x27;` (o token `--font-sans` do design-tokens.css tem 'Inter' entre
// aspas simples) e essa entidade chega crua no DOM real, sem virar aspas de novo. O texto
// que a hidratação espera (a string original, com aspas) nunca bate com o texto que o
// navegador efetivamente colocou no elemento, e React acusa mismatch. `dangerouslySetInnerHTML`
// insere a string exatamente como está, sem passar pelo escape de texto do JSX, então o
// que o servidor manda é byte a byte o que o cliente hidrata: sem mismatch, e o CSS gerado
// fica válido (sem entidade sobrando dentro da declaração de fonte).
export async function SalaTema() {
  const tema = await obterTema()
  const variaveis = Object.entries(tema)
    .map(([chave, valor]) => `${chave}: ${valor};`)
    .join(" ")
  const css = `:root { ${variaveis} }`

  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
