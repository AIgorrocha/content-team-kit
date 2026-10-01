<!-- GERADO por scripts/gen-wiki.mjs a partir de agents/*.md. Nao editar na mao. -->

# Agentes

Total: 25 agentes. Ver [regras do time](../../CLAUDE.md).

| Agente | Descricao |
|---|---|
| [ct-ads-account-structure-audit](ct-ads-account-structure-audit.md) | Sub-agente de auditoria Meta Ads, estrutura da conta, learning phase, CBO/ABO, Advantage+ Sales, consolidacao, atribuicao. 11 checks, peso 20% no score. Acionad |
| [ct-ads-audit](ct-ads-audit.md) | Auditor Master Meta Ads. Orquestra 4 sub-agentes (conversion, creative, budget, account-structure), agrega scores e entrega relatorio com Quick Wins, plano de a |
| [ct-ads-budget-audit](ct-ads-budget-audit.md) | Sub-agente de auditoria Meta Ads, orcamento, audiencia, exclusoes, lookalikes, frequency cap, breakdowns. 9 checks, peso 20% no score. Acionado pelo ct-ads-audi |
| [ct-ads-conversion-audit](ct-ads-conversion-audit.md) | Sub-agente de auditoria Meta Ads, Pixel, CAPI, EMQ, dedup, atribuicao, AEM. 14 checks ponderados, peso 30% no score final. Acionado pelo ct-ads-audit. |
| [ct-ads-creative-audit](ct-ads-creative-audit.md) | Sub-agente de auditoria Meta Ads, diversidade de criativo, fadiga, frequencia, hook rate, Andromeda Similarity. 13 checks, peso 30% no score final. Acionado pel |
| [ct-agenda](ct-agenda.md) | Agenda - Gerente de Prazos. Calendário editorial, agendamentos e prazos. |
| [ct-carrossel](ct-carrossel.md) | Carrossel - Designer de Carrossel. Slides Instagram 1080x1350. |
| [ct-designer](ct-designer.md) | Designer - Diretor de Arte. Identidade visual e consistência. |
| [ct-diretor](ct-diretor.md) | Diretor - Diretor de Conteúdo. Orquestra todos os sub-agentes, nunca produz conteúdo diretamente. |
| [ct-email](ct-email.md) | Email - Email Marketing. Newsletters e campanhas. |
| [ct-integrador](ct-integrador.md) | Integrador - Integrador Técnico. APIs, automações e webhooks. |
| [ct-otimizador](ct-otimizador.md) | Otimizador - Otimizador de Plataforma. Adapta conteúdo por rede. |
| [ct-parcerias](ct-parcerias.md) | Parcerias - Relações Públicas. Parcerias com influenciadores. |
| [ct-pesquisador](ct-pesquisador.md) | Pesquisador - Pesquisador. Tendências, concorrentes e pesquisa internacional. |
| [ct-reciclador](ct-reciclador.md) | Reciclador - Reciclador de Conteúdo. Transforma 1 conteúdo em vários formatos. |
| [ct-redator](ct-redator.md) | Redator - Redator. Legendas, textos, scripts, emails e CTAs. |
| [ct-social](ct-social.md) | Social - Social Media. DMs, escuta social e respostas. |
| [ct-story](ct-story.md) | Story - Editor de Stories. Monta sequencia com arco narrativo (bastidor, rotina, discussao, insight), default de 3-5 telas e excecao de sequencia de ensino ate  |
| [ct-trafego](ct-trafego.md) | Gestor de Tráfego - Analisa, otimiza e gerencia campanhas Meta Ads. |
| [ct-video](ct-video.md) | Vídeo - Editor de Vídeo. Avatar digital HeyGen + edição Reels. |
| [ct-video-editor](ct-video-editor.md) | Bridge entre ct-diretor e o pipeline ct-video-editor (CapCut por codigo). Edita video gravado pelo talento (talking head) em Reel/Short: legenda automatica pala |
| [ct-video-higgsfield](ct-video-higgsfield.md) | Bridge entre ct-diretor e Higgsfield AI via CLI oficial @higgsfield/cli. Gera Reels cinematograficos automatizados (image-to-video, two-frame start+end, lipsync |
| [ct-video-hypit](ct-video-hypit.md) | Ponte entre ct-diretor e o Hypit (ferramenta externa, opcional). Clona a ESTRUTURA de um video que performa bem (roteiro, cortes, legenda palavra a palavra, B-r |
| [ct-video-mpt](ct-video-mpt.md) | Bridge entre ct-diretor e MoneyPrinterTurbo (motor de video faceless). Gera Reels narrados a partir de roteiro + clipes de banco (Pexels) + TTS PT-BR + legenda  |
| [ct-video-remotion](ct-video-remotion.md) | Bridge entre ct-diretor e Remotion (video por codigo React). Gera videos animados white-label (reels motion, aberturas, lower-thirds, data-viz animada) na ident |
