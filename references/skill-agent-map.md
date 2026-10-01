# Catalogo de skills (fonte canonica)

Este arquivo e o CATALOGO COMPLETO das skills do repo: toda skill, o agente dono
e uma linha do que ela faz. O `CLAUDE.md` carrega so as familias e as de uso
diario, e aponta pra ca. Se a skill nao esta aqui, ela nao existe.

Numeros atuais do kit: **66 pastas em `skills/`, 65 skills invocaveis** (1 e
infra sem `SKILL.md`: `_shared`).

## Duas regras que valem pra tudo

**Nome da pasta e a identidade.** O `name:` do frontmatter e igual ao nome da pasta
em todas as skills. `help-guide` tambem e comando do Telegram (`/skills`, `/help`):
o `name:` dele e o comando. Renomear quebraria o comando. Marcada `[cmd]` abaixo.

**Skill de PRODUCAO passa pelo agente dono**, que por sua vez e orquestrado pelo
`ct-diretor`. Skill de leitura e analytics pode rodar direta, mas o resultado
volta pro agente dono virar decisao editorial.

Fluxo: `Telegram -> ct-orquestrador -> ct-diretor -> AGENTE DONO -> skill`

**`environment: local` no frontmatter** marca skill que so roda no terminal do PC
(Playwright logado, Docker local, Drive montado, iCloud). Essas nao
devem ser acionadas por canal remoto (Telegram). Marcadas `[local]`.

## Orquestracao

| Skill | Dono | O que faz |
|---|---|---|
| ct-orquestrador | (entrada) | Porta de entrada do Telegram. Classifica o pedido e roteia pro ct-diretor |
| ct-peca `[local]` | ct-diretor | Maestro do fluxo completo de uma peca: inbox iCloud, apuracao na fonte, IG, LinkedIn, midias, Drive, agendar, registrar. Define ordem e portoes de aprovacao, invoca as skills donas |

## Producao de conteudo

| Skill | Dono | O que faz |
|---|---|---|
| ct-carrossel-gen | ct-carrossel | Carrossel Instagram em PNG 1080x1350 na identidade da marca ativa: `node skills/ct-carrossel-gen/scripts/generate-slides.js --nome X` le `content/{slug}/carousels/X/slides.json` |
| ct-criativos-lote `[local]` | ct-designer | Lote de criativo estatico/reel (story/feed/reel) via Remotion, generico white-label, a partir de `clients/{slug}/criativos/presets.json` |
| ct-story | ct-redator + ct-social | Renderiza Story IG 1080x1920 em PNG. Conteudo e arco vem do agente ct-story |
| ct-reel | ct-video | Pipeline completo de Reels |
| ct-telas | ct-designer + ct-video | Telas de demonstracao pra Reel via Playwright |
| ct-template-designer | ct-designer | 3 variacoes visuais de template (HTML+CSS) com hard rules, renderizadas pra aprovacao |
| ct-adaptar | ct-reciclador | Adapta post viral de concorrente (link IG ou texto colado) pro publico do cliente ativo |
| ct-artigo-linkedin | ct-redator | Pipeline do cliente ativo: NotebookLM, artigo blog, carrossel IG, post LinkedIn. TRIGGER ON-DEMAND, nunca automatico |
| ct-plano-semanal | ct-agenda | Planejamento editorial semanal cruzando brand-profile, top posts (ct_research_posts) e series ativas |
| ct-thumbnail | ct-designer | Pacote YouTube: SEO, titulo, descricao, tags, prompt de thumbnail (Gemini/NanoBanana) |
| ct-yt-linkedin | ct-redator | Video YouTube vira post LinkedIn otimizado com link |
| ct-extrair-reel | ct-pesquisador + ct-reciclador | Extrai Reel do IG (legenda + transcricao) e adapta |
| ct-republicar-twitter | ct-redator | Adapta LinkedIn → thread e enfileira. Nao chama post.js |
| ct-openshorts `[local]` | ct-video | Ponte OpenShorts (Opus Clip MIT). So video LONGO YouTube, nao talking-head. Nao auto-publica |
| diagram-design | ct-designer | Fluxograma editorial HTML+SVG (processo, arquitetura, loop). Sem Mermaid, tokens do cliente ativo |

Escopo estreito. Nao e pipeline generico:

| Skill | Dono | O que faz |
|---|---|---|
| ct-projeto-conteudo `[local]` | ct-diretor | Transforma entrega tecnica (arquivos de projeto, prints) em storytelling de conteudo (carrossel IG, reel, estatico) e adaptacao LinkedIn Company Page. Exclusivo de clientes com esse fluxo, nunca cita cliente real (trava LGPD) |

## Publicacao e agendamento

| Skill | Dono | O que faz |
|---|---|---|
| ct-publicar-ig | ct-otimizador | Publica no Instagram via Meta Graph API (imagem, carrossel, reel, stories) |
| ct-publicar-li | ct-otimizador | Publica no LinkedIn via API oficial (texto puro e texto com imagem) |
| ct-publicar-tiktok `[local]` | ct-otimizador | Publica no TikTok via TikTok Studio web com Playwright logado |
| ct-publicar-yt | ct-otimizador | Publica no YouTube com porta bloqueante de acentuacao. So clientes com YouTube ativo |
| ct-agendar | ct-agenda | Agendamento e execucao de publicacao (IG + LinkedIn) |

## Pesquisa e analise

| Skill | Dono | O que faz |
|---|---|---|
| ct-analyzer | ct-pesquisador | Router de analise: detecta a plataforma pelo URL ou contexto e delega pra skill certa |
| ct-instagram-analyzer | ct-pesquisador | Analisa conta IG. Graph API pras contas do cliente ativo, RapidAPI `instagram-looter2` pra perfil de terceiro. Absorveu a antiga `ct-analisar-ig` em 30/ago/2026 |
| ct-linkedin-analyzer | ct-pesquisador | Analisa post LinkedIn pessoal e company do cliente ativo via REST API |
| ct-youtube-analyzer | ct-pesquisador | Analisa o canal YouTube do cliente via Data API v3 |
| ct-tiktok-analyzer `[local]` | ct-pesquisador | Scraper TikTok via Playwright logado. So clientes com TikTok ativo |
| ct-twitter-research `[local]` | ct-pesquisador | Pesquisa Twitter/X via Playwright autenticado (timeline, bookmarks, search). So clientes com X ativo |
| ct-pesquisa | ct-pesquisador | Pesquisa profunda de concorrente e tendencia (IG via RapidAPI, Reddit, X, LinkedIn) |
| ct-pesquisa-cliente | ct-pesquisador | Pesquisa e setup de conteudo pra cliente novo no framework white-label |
| ct-seo | ct-pesquisador | Keywords e tendencias pra conteudo social via Playwright |
| claude-seo `[plugin externo]` | ct-pesquisador | Plugin oficial (github.com/AgriciDaniel/claude-seo, MIT), instalado em escopo de usuario, fora deste repo. 25 skills de SEO, invocadas como `claude-seo:seo-content-brief`, `claude-seo:seo-content`, `claude-seo:seo-plan`, `claude-seo:seo-page`, etc. Consultar `claude-seo:seo-content-brief` pra pesquisa de keyword ANTES de fechar titulo/descricao/tags/texto de thumbnail, em qualquer cliente. So ativa numa sessao NOVA apos instalar/atualizar o plugin (snapshot de sessao). Se a sessao atual for anterior a instalacao: rodar em processo headless separado, `claude -p "use a skill claude-seo:seo-content-brief para ..."` via Bash, em vez de esperar reiniciar o terminal. Nao bloqueia o fluxo se indisponivel |
| geo-content-optimizer | ct-pesquisador | Otimiza conteudo pra ser citado por IA (ChatGPT, Perplexity, AI Overviews, Gemini) |
| ct-web | ct-pesquisador + ct-designer | Pesquisa na web |
| last30days | ct-pesquisador | Tema dos ultimos 30 dias multi-fonte rankeado por engajamento real. Vendorizada de mvanhorn/last30days-skill (MIT) |
| ct-ig-saved-inspiration `[local]` | ct-pesquisador | Raspa posts SALVOS do IG do cliente ativo via Playwright logado, diff por shortcode em ct_saved_inspiration, transcreve video. Roda semanalmente |
| ct-icloud-inbox `[local]` | ct-diretor + ct-integrador | Inbox do iPhone (iCloud Drive ou pasta Desktop). Copia o ORIGINAL sem recomprimir. NUNCA publica |
| ct-instagram-audit | ct-diretor | Auditoria quantitativa reproduzivel da conta propria do cliente ativo a partir do snapshot do `ct-instagram-analyzer`: distribuicao por formato, duracao, legenda, dia/hora, tendencia mensal, comentarios e outliers |

## Inteligencia e painel

| Skill | Dono | O que faz |
|---|---|---|
| ct-social-cockpit | ct-pesquisador | Painel unificado de performance por cliente em `content/{cliente}/cockpit.md`. ct-diretor le ANTES de produzir |
| ct-aprender-perfil | ct-pesquisador | Aprendizado DIARIO do perfil: le feed, reel (normal e trial) e story (inclusive postado a mao) por `scripts/analytics/aprender-perfil-dados.mjs`, atualiza `clients/{slug}/aprendizado-do-perfil.md` e, com travas (3 publicacoes em 30 dias acima da mediana, nunca apaga, max 3 mudancas por marca por dia), `voice-patterns.md` e `regras-cliente.md`. Resumo na conversa (Telegram so se configurado). Ao abrir a pasta ou por "aprender com o meu perfil". Ver `docs/APRENDIZADO-DIARIO.md` |
| ct-social-intel | ct-pesquisador | Best-time computado do historico real (ct_metrics_snapshots): heatmap 7x24 por rede e cliente |

## Meta Ads

| Skill | Dono | O que faz |
|---|---|---|
| ct-ads-tracker | ct-trafego | Analise de campanha Meta Ads das contas do cliente ativo + PostHog. Absorveu a antiga `ads-manager` em 30/ago/2026 |
| ct-ads-evals | ct-trafego | 14 checks sinteticos ponderados de saude de campanha (Pixel/CAPI, fadiga, estrutura, audiencia), score 0-100 |

Auditoria profunda de conta e a familia de AGENTES `ct-ads-*`, nao skill. Ponto de
entrada unico: `ct-ads-audit`.

## DM e comentario

| Skill | Dono | O que faz |
|---|---|---|
| ct-dm-auto `[local]` | ct-social | "Comenta PALAVRA que te mando X": regras em `data/ig-webhook/rules.json` (modelo em `scripts/ig-webhook/rules.example.json`), ig-webhook em servidor proprio, Instagram + YouTube. Sem palavra-chave nao ha resposta. NUNCA LinkedIn nem TikTok |

## Video (motores)

| Skill | Dono | O que faz |
|---|---|---|
| ct-higgsfield-prompt | ct-video-higgsfield | Prompt MCSLA pra Higgsfield AI (Kling 3.0, Veo 3.1, Seedance 2.0) |
| ct-reel-narrado-higgsfield `[local]` | ct-video-higgsfield | Reel com a voz real do cliente + visual Higgsfield + legenda CapCut por frase (WhisperX) + SFX, montado no Remotion (`scripts/video-editor/build-narrated-captions.mjs` + composicoes NarratedReel e ReelCover) |
| ct-remotion | ct-video-remotion | Video animado por codigo (Remotion/React): motion graphics, data-viz animada. Composicoes: AnimatedReel, CapCutSplit, CapCutSplitAlt, StoryScenes, BlurFillVideo, DrawOn, NarratedReel, ReelCover, StaticCreative |
| ct-motion-code `[local]` | ct-video-remotion | Motion graphics em codigo (rota A, sem framework): HTML + canvas + window.seek(t) + Playwright + ffmpeg, mola matematica deterministica. Catalogo de todas as tecnicas: `skills/ct-motion-code/catalogo-tecnicas.md` |
| ct-video-mpt `[local]` | ct-video-mpt | Video faceless via MoneyPrinterTurbo: clipe de banco (Pexels) + TTS PT-BR + legenda auto |
| ct-video-editor `[local]` | ct-video-editor | "CapCut por codigo": edita talking-head gravado em Reel com legenda palavra-a-palavra (WhisperX). Split OU janela na camisa (secao 1g) conforme o enquadramento |

## Open Design (familia ct-od-*)

Artefato web standalone com os tokens do cliente ativo. Todas com dono `ct-designer`.

| Skill | O que faz |
|---|---|
| ct-od-design-import | Importa e aplica design system do catalogo Open Design sobre os tokens do cliente ativo. Pre-requisito das outras quatro |
| ct-od-deck | Deck HTML scroll-horizontal (6-18 slides). Substitui carrossel quando o formato pede deck web |
| ct-od-blog | Blog post / artigo long-form HTML com hierarquia tipografica magazine |
| ct-od-landing | Landing page SaaS-style (hero, features, prova social, CTA, footer). Pra proposta comercial Vercel |
| ct-od-prototype | Prototipo web generico sem estrutura fixa. Mockup interno, sketch de feature |
| design-taste-frontend | Landing page, portfolio e redesign sem cara de modelo pronto (leitura do briefing, 3 controles de estilo, checagem final). Terceiro, MIT (taste-skill), ver `THIRD-PARTY-NOTICES.md` |

## Operacao e ferramentas

| Skill | Dono | O que faz |
|---|---|---|
| help-guide `[cmd]` | (assistivo) | "o que voce sabe fazer?", "ajuda": guia interativo de skills e agentes por dominio, inclusive configuracao e manutencao |
| ct-banco | ct-integrador | Consulta as tabelas ct_* via Supabase MCP |
| ct-obsidian | ct-integrador | Gerencia notas Obsidian via MCP |
| ct-notebook | ct-integrador | Google NotebookLM: podcast, quiz, resumo, slides. O infografico obrigatorio sai daqui |
| proposta-white-label | (dominio proprio) | Amostra gratis distribuivel: proposta comercial em HTML standalone pra qualquer empresa, parametrizada por company-profile.yaml. Auto-contida |
| ct-onboarding `[local]` | ct-diretor | Configuracao completa por conversa: prepara o computador, cria `clients/{slug}/`, mostra previas de legenda, carrossel, reel, story e design para a pessoa escolher, e guia a conexao das redes pelo navegador (`references/conexoes-guiadas.md`). Retomavel ("continuar configuracao") |
| ct-atualizar-kit `[local]` | (assistivo) | "atualizar o kit": traz a versao nova do kit sem mexer na marca; "criar meu repositorio privado": guarda a marca num repositorio privado da pessoa |
| ct-reportar-problema `[local]` | (assistivo) | "reportar problema", "sugerir melhoria": monta o relatorio sem segredo nem dado da marca, mostra antes e envia so com "pode" |
| ct-avaliar-novidade `[local]` | ct-diretor | "avaliar essa ferramenta", link de skill ou repositorio: le sem executar, confere licenca, seguranca e valor, diz onde encaixa e so instala ou integra com "pode" |

## Infra (nao invocavel, sem SKILL.md)

| Pasta | O que e |
|---|---|
| _shared | Helpers compartilhados. `post-key.cjs` e o dono unico da normalizacao de URL de post |

## Manutencao

Ao criar, renomear ou remover skill:

1. Atualize ESTE arquivo (e so a familia no `CLAUDE.md`, se a familia mudar).
2. `npm run sync:skills`. A reconciliacao marca `active=false` no `ct_skills`
   pro slug que perdeu a pasta, entao slug fantasma nao sobrevive mais.
