---
name: ct-dm-auto
description: Monta e opera o fluxo "comenta PALAVRA que te mando X" (comentario vira resposta publica e DM com o material) no Instagram, e a resposta publica por palavra no YouTube, na voz da marca ativa. Usa o servico proprio scripts/ig-webhook (API oficial da Meta, gratis). Nunca LinkedIn nem TikTok. Nao liga em conta real sem "pode" do usuario. EXCLUSIVO terminal local.
owner: ct-social
environment: local
---

# ct-dm-auto

Faz o papel do ManyChat, de graca e no seu proprio servidor: alguem comenta uma palavra no post,
o servico responde em publico ("Te mandei no direct") e entrega o material no privado.

- Instagram: `scripts/ig-webhook/server.mjs` (comentario vira resposta publica + DM, via Private Reply da Meta).
- YouTube: `scripts/ig-webhook/yt-comment-responder.mjs` (resposta publica na thread, YouTube nao tem DM).
- Os dois leem o MESMO arquivo de regras: 1 palavra, 1 material, todas as redes.

EXCLUSIVO terminal local. Nunca via bot do Telegram.

## Montar do zero (1 vez)

Passo a passo completo, com app na Meta, webhook e App Review: `scripts/ig-webhook/PASSO-A-PASSO.md`.
Textos e roteiro da revisao da Meta: `scripts/ig-webhook/APP-REVIEW.md`. Modelo da politica de
privacidade: `scripts/ig-webhook/privacy-policy.html`.

Resumo: criar o app na Meta, preencher no `.env.local` as variaveis do servico (`INSTAGRAM_USER_ID`,
`INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_APP_SECRET`, `IG_APP_ID`, `IG_VERIFY_TOKEN` e `PUBLIC_BASE`, o endereco
publico HTTPS do servidor), subir o servico e cadastrar o webhook. Sem `PUBLIC_BASE` o login da Meta e a URL
de exclusao de dados nao funcionam (o servico avisa no log ao iniciar).

## Regras (arquivo `data/ig-webhook/rules.json`)

Primeira vez: `mkdir -p data/ig-webhook` e `cp scripts/ig-webhook/rules.example.json data/ig-webhook/rules.json`,
depois edite. (Outro caminho: variavel `RULES_FILE`.) Regra nova vale sem reiniciar: abra
`PUBLIC_BASE/ig-webhook/reload`. Saude: `PUBLIC_BASE/ig-webhook/health`. Historico: `data/ig-webhook/events.log`.

Campos de cada regra:

| Campo | Para que serve |
|---|---|
| `id` | nome interno da regra |
| `keyword` | a palavra (vale como expressao regular, sem diferenciar maiuscula de minuscula). Obrigatoria |
| `link` ou `links: [{label, url}]` | o material entregue. Com `links`, vai mais de um na mesma DM |
| `publicReply` | resposta publica no comentario (padrao: "Te mandei no direct.") |
| `linkText` | frase que abre a DM (padrao: "Aqui está o material:") |
| `ytReply` | frase da resposta no YouTube |
| `mediaIds` | lista de IDs de post. Vazio: a palavra vale em qualquer post. Preenchido: so naqueles posts |
| `anyComment` | so com `mediaIds`: qualquer comentario NAQUELE post entrega o material, mesmo sem a palavra |
| `followGate` | `true`: so entrega a quem segue (pede follow com botao "Ja segui"). Exige a permissao `instagram_business_manage_messages`, que e mais dificil de aprovar. O modelo vem com `false` |

Regras de ouro sobre as regras:

1. **Sem palavra-chave nao ha resposta.** Comentario que nao bate em nenhuma palavra fica sem resposta, para o
   dono da conta seguir respondendo as outras pessoas. Nao existe "responder todo comentario" na conta inteira.
   `anyComment: true` so funciona junto de `mediaIds` (post especifico, campanha no ar); sem `mediaIds` ele
   nao faz nada. Ligue so enquanto a campanha estiver no ar.
2. **Toda palavra-chave entrega uma pagina ou material completo**, pronto para abrir (pagina publicada,
   guia, modelo). Nunca arquivo cru nem link de armazenamento (Storage, Drive) que baixa ou pede login.
3. **A DM abre entregando.** Primeira frase: "Aqui está o material". Nunca abrir agradecendo o follow ou
   o comentario: a pessoa veio pelo material.
4. A palavra de uma regra vale em qualquer post, a menos que `mediaIds` limite. Palavra que faz parte de
   outra palavra comum ("anima" dentro de "animais") precisa de limite na expressao, por exemplo
   `(?<![a-zà-ÿ])anima(?![a-zà-ÿ])`.
5. Keyword de outra regra sempre ganha de `anyComment`.

Regra dura: so escrever "comenta PALAVRA" numa legenda se a PALAVRA ja estiver em `rules.json` E recarregada
no servidor. Legenda com palavra sem regra queima confianca e obriga a trocar o texto depois de publicado.

## Codigo morto conhecido (nao apagado)

Em `scripts/ig-webhook/server.mjs`, `FALLBACK_RULE` e o ramo `generic` de `linkMsg` sobraram de uma versao
antiga que respondia todo comentario com um agradecimento. Hoje nunca disparam (sem palavra-chave nao ha
resposta). Podem ser removidos numa limpeza futura.

## Limites da Meta que o fluxo tem que respeitar

- **Private reply: 7 dias** contados da criacao do comentario, e **um unico private reply por comentario**.
  Servico parado ou fila atrasada queima a janela.
- **Janela de 24h** para mensagem livre depois da ultima mensagem da pessoa. Fora dela, envio sem tag falha.
- **Conta em modo Desenvolvimento**: so contas com papel no app disparam. Para qualquer seguidor usar, o app
  precisa passar no App Review e ficar Ativo (Live). Sem isso, teste so com a propria conta e testadores.
- O token do Instagram vence. DM parou de sair: olhe o `events.log` e gere outro token.

## O que a mecanica NAO promete

DM respondida **nao sobe alcance**: nenhum sinal publicado pela Meta envolve taxa de resposta a DM (ja
registrado em `agents/ct-social.md` como `[MECANICA]`). O ganho e **conversao e relacao**, nunca
distribuicao. Nao prometer alcance ao usuario.

## Regras duras

1. **"Comenta PALAVRA" so em Instagram e YouTube. NUNCA LinkedIn nem TikTok.** No LinkedIn o fecho e
   pergunta aberta (`references/viral-playbook.md`, secao 4). TikTok nao tem automacao de comentario aqui.
2. **Fluxo primeiro, CTA depois.** O CTA so vai ao ar depois do fluxo montado, recarregado e TESTADO com um
   comentario real de conta de teste. Prometer "comenta X que te mando Y" sem automacao respondendo queima confianca.
3. **A voz do bot e a voz da marca ativa.** Todo texto de regra passa pelo `ct-redator`; tom e registro
   seguem o `brand-profile.md` da marca ativa.
4. **Aprovacao antes de ligar em conta real.** A conta e ativo do negocio da marca ativa: so liga com "pode".
5. **Sem promessa que o fluxo nao cumpre.** Se a entrega e uma pagina, o fluxo entrega a pagina.

## Marca ativa (white-label)

Le sempre, nesta ordem, sem `if slug ==`:

1. `.workspace` (ou env `CT_CLIENT`), fallback `clients/active-client.md`
2. `clients/{slug}/brand-profile.md` (tom de voz, publico, hooks, proibicoes)
3. `clients/{slug}/design-system.md` se a entrega for uma peca visual

Um servico por marca (cada marca com a propria conta e o proprio `.env.local`). Regra de uma marca nunca
responde pela conta de outra.

## Fluxo de trabalho

1. **Briefing** com o `ct-diretor`: qual peca, qual palavra, o que e entregue, para qual conta.
2. **Copy** com o `ct-redator`: palavra-gatilho (curta, sem acento, sem ambiguidade com comentario normal),
   `publicReply` e `linkText` ("Aqui está o material...").
3. **Cadastrar** a regra em `data/ig-webhook/rules.json` e recarregar (`/reload`).
4. **Testar** com comentario real de conta de teste. Sem teste passando, o CTA nao entra na peca.
5. **So entao** o CTA "comenta PALAVRA" entra na legenda da peca.
6. **Escuta:** o que aparece repetido nos comentarios volta para o `ct-pesquisador` como insumo de pauta.

## Divisao de trabalho

| Quem | Faz |
|---|---|
| `ct-social` | DONO. Desenha o fluxo, opera, cuida da escuta social |
| `ct-redator` | Escreve todo texto das regras, na voz da marca ativa |
| `ct-diretor` | Orquestra, decide se a peca leva CTA de captura |
| `ct-pesquisador` | Recebe o que se repete em comentario e DM |

## O que o usuario faz na mao

- Criar o app na Meta, preencher o `.env.local` e (se quiser publico) passar no App Review
- Colocar o servico num endereco publico HTTPS (servidor proprio ou tunel)
- Aprovar ("pode") antes de ligar em conta real
