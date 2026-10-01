---
name: ct-artigo-linkedin
description: Pipeline completo de conteudo do cliente ativo (NotebookLM -> artigo no blog -> carrossel Instagram -> post LinkedIn). Alias conceitual ct-conteudo-cliente.
---

# Skill: ct-artigo-linkedin (alias conceitual: ct-conteudo-cliente)

Requer que o cliente ativo tenha blog e LinkedIn no fluxo editorial: conferir a secao
`Pipeline Artigo+LinkedIn` (ou equivalente) em `clients/{slug}/brand-profile.md`. Sem essa
secao, esta skill nao se aplica ao cliente ativo.

## Gatilho automatico: IG aprovado -> LinkedIn (nao perguntar)

Assim que o usuario APROVAR o post/legenda do Instagram, ja preparar a versao LinkedIn sem ele pedir. LinkedIn e OUTRO formato: alem do texto (paragrafos curtos, abertura direta sem cliche, pergunta final especifica so quando vier natural, sem hashtag por padrao), gerar IMAGEM (`linkedin-imagem.png` 1920x1080, OU JPGs das pranchas via ct-carrossel). Projeto com pranchas: NUNCA PDF (LinkedIn recusa) e NUNCA so o texto. Preparar nao e publicar: publicar so com o "pode" do usuario, pela ordem unica (igual em `agents/ct-diretor.md` e `skills/ct-peca`): API se a marca tem app LinkedIn configurado, senao navegador (Claude in Chrome) com "pode", senao manual. Link do artigo no PRIMEIRO COMENTARIO, nao no corpo (excecao por marca so se registrada em `regras-cliente.md`).

## Limites LinkedIn (2026)

Limites reais (fontes: socialrails.com, powerin.io, authoredup.com, typecount.com, 2026):

| Superficie | Limite hard | Sweet spot de engajamento |
|------------|-------------|---------------------------|
| Company Page post (normal) | **3.000 chars** | 1.500-2.000 pra conteúdo denso |
| Perfil pessoal post | 3.000 chars | 1.500-2.000 |
| Company Update (tipo antigo) | 1.300 chars | (nao se aplica) |
| Article (Pulse) | 110.000+ chars | (nao se aplica) |
| Comentario | 1.250 chars | (nao se aplica) |

**Hook forte obrigatório nos primeiros 140 chars** (antes do "Ver mais" mobile).

Faixas de performance (`[HIPOTESE]`, fontes externas nao validadas nas contas da marca; ponto de partida, nao meta; o limite duro e 3.000):
- 100-300 chars: CTAs rápidos
- 1.200-1.500 chars: posts médios
- **1.500-2.000 chars: sweet spot padrão de posts de valor**
- 1.800-2.100 chars: engajamento máximo em posts densos (segundo as fontes externas)
- **2.700-2.900 chars: long-form técnico/educacional** (artigos-âncora, temas destrinchados, cases com muito dado). Usar quando o tema justifica profundidade, não diluir em posts comuns.

Meta de chars por post (Company Page vs. perfil, faixa padrão vs. artigo-âncora): ler a
secao `Pipeline Artigo+LinkedIn` de `clients/{slug}/brand-profile.md`.

> **Pipeline obrigatório quando o cliente ativo usa este fluxo**
>
> 1. NotebookLM (pesquisa, fontes, infográficos, slides), PRIMEIRO
> 2. Artigo no blog do cliente (URL em `brand-profile.md`), publicado ANTES do Instagram
> 3. Instagram carrossel, destilação visual, reaproveitando criativos do NotebookLM
> 4. LinkedIn: Claude prepara texto + link; publica pela ordem unica acima (API, navegador com "pode" ou manual); agendamento so com a API, senao o usuario agenda pelo proprio LinkedIn

> Observação sobre o nome: mantemos o diretório `ct-artigo-linkedin` por compatibilidade com invocações já existentes. Conceitualmente esta skill cobre o pipeline completo de conteúdo do cliente (ct-conteudo-cliente). Renomeação física do diretório é operação futura separada.

Pipeline end-to-end de produção de conteúdo, partindo da pesquisa no NotebookLM até a publicação final em 3 canais (blog, Instagram, LinkedIn).

## Quando invocar (TRIGGER-ON-DEMAND, 3 canais)

Esta skill NUNCA roda em trigger automático. Sempre requer solicitação explícita do usuário no terminal. O estado fica no Supabase (source of truth).

| Canal | Como dispara | Estado |
|-------|-------------|--------|
| 1. Terminal (Claude Code ou Codex) | Pedido em linguagem natural ("artigo sobre X"), conduzido pelo diretor (`agents/ct-diretor.md`) | Funcionando |

### PROIBIDO

- NUNCA criar trigger automático
- NUNCA agendar esta skill em cron/ct-schedule
- NUNCA tentar token/scope de organizacao do LinkedIn sem a Community Management API aprovada (ver status em `clients/{slug}/brand-profile.md`); sem ela, use navegador com "pode" ou manual
- NUNCA repetir a tentativa de aprovação LinkedIn (plano realista: navegador ou publicação manual)

## Contexto

- Cliente ativo: qualquer cliente com blog + LinkedIn no fluxo (ver `clients/active-client.md`)
- Usuário pede: "artigo sobre X", "conteúdo técnico [cliente]", "novo post no blog [cliente]"
- Objetivo: autoridade de marca + SEO orgânico + reutilização cross-canal (1 pesquisa, 3 formatos)

## Pré-requisitos

- [x] Cliente ativo com fluxo blog+LinkedIn (`clients/active-client.md`)
- [x] Template: `clients/{slug}/templates/artigo.md`
- [x] Repo do site do cliente: caminho local em `clients/{slug}/brand-profile.md`
- [x] Supabase: tabela `ct_notebooks` existe
- [x] Skill `notebooklm` disponível no harness

## Regra-Zero: Notebook como memória viva

**ANTES de qualquer etapa deste pipeline, anexar ao notebook do tema TODOS os resultados Claude Code já existentes que sejam relevantes:**

- Pesquisas anteriores em `content/{slug}/pesquisa/*.md`
- Drafts e artigos em `content/{slug}/artigos/{slug-artigo}/`
- Carrosséis anteriores em `content/{slug}/carousels/`
- Posts em `content/{slug}/posts/`
- Brand profile, design system, historico IG do cliente
- Transcrições e decisões de sessão relevantes em `content/{slug}/sessoes/`
- Pipeline docs específicos do cliente, se existirem (ver `brand-profile.md`)

Notebook é memória VIVA do tema. Pipeline acumulativo, resultados viram contexto das próximas iterações.

Verificar antes se cada fonte já está no notebook (via `notebooklm source list -n <id>`). Não duplicar.

## Pipeline (12 etapas)

```
[0] Regra-zero: anexar artefatos Claude Code existentes ao notebook do tema
        |
[1] ct-pesquisador -> pesquisa inicial do tema
    -> ao fim, anexar MD da pesquisa ao notebook
        |
[2] Skill(notebooklm) -> cria notebook NOVO com fontes curadas
    - Salva notebook_id em ct_notebooks
    - Extrai resumo executivo, infográficos, slides
    - OBRIGATÓRIO: gerar APENAS 3 artefatos nativos (padrão, salvo se o cliente pedir diferente
      no brand-profile.md):
        1. Infográfico vertical (portrait)
        2. Infográfico horizontal (landscape)
        3. Slide deck (apresentação)
      NÃO GERAR por padrão: video overview, audio overview, mind-map (a menos que o cliente peça).
      Comandos (sempre --language pt_BR):
        notebooklm generate infographic  -n <id> --orientation portrait  --style professional --language pt_BR --json
        notebooklm generate infographic  -n <id> --orientation landscape --style professional --language pt_BR --json
        notebooklm generate slide-deck   -n <id> --format detailed --language pt_BR --json
      Após status completed (verificar via notebooklm artifact list -n <id> --json),
      baixar pra subpasta notebooklm/ da publicação:
        notebooklm download infographic -n <id> -a <artifact_id> --force content/{slug}/artigos/{slug-artigo}/notebooklm/infografico-vertical.png
        notebooklm download infographic -n <id> -a <artifact_id> --force content/{slug}/artigos/{slug-artigo}/notebooklm/infografico-horizontal.png
        notebooklm download slide-deck  -n <id> -a <artifact_id> --format pdf  --force content/{slug}/artigos/{slug-artigo}/notebooklm/slide-deck.pdf
      Estrutura de saída consolidada:
        content/{slug}/artigos/{slug-artigo}/notebooklm/
          - infografico-vertical.png
          - infografico-horizontal.png
          - slide-deck.pdf
      o usuario analisa os 3 artefatos manualmente e decide como reaproveitar.
      Salvar IDs em ct_notebooks.artifacts (jsonb):
        infographic_portrait_id, infographic_landscape_id, slide_deck_id, local_path
    - Atenção: o code da CLI pra PT-BR é pt_BR (não pt-BR).
    - No Windows usar PYTHONIOENCODING=utf-8 antes do comando pra evitar
      UnicodeEncodeError em saídas com acentos.
        |
[3] ct-designer -> monta infográficos customizados baseados no notebook
    - HÍBRIDO: usamos AMBOS os conjuntos de criativos:
      a) Nativos NotebookLM (rápidos, automáticos, salvos em notebooklm/infograficos-nativos/)
      b) Customizados na identidade do cliente (design system do cliente, gerados via HTML+Playwright)
    - Aproveita visuais/slides do notebook como base
    - Paleta e tipografia: ler clients/{slug}/design-system.md
    - REGRA 3 FORMATOS:
      * horizontal (1200x800): blog, LinkedIn banner
      * vertical (1080x1350): IG feed standalone
      * slide-inside-carousel (1080x1350): VERSÃO INTEGRÁVEL NO CARROSSEL (design system do cliente aplicado,
        zona segura topo 150/base 175/laterais 65, hierarquia definida no design-system.md)
      Naming: {nome}-horizontal.png, {nome}-vertical.png, {nome}-slide.png
    - Salva em content/{slug}/artigos/{slug-artigo}/criativos/
    - Copia cover/infográficos finais (ambos formatos) pra {site-repo}/public/assets/images/blog/{slug-artigo}/
    - IMPORTANTE: quando tema envolver cronogramas/listas/grids/comparativos, a versão slide-inside-carousel
      é OBRIGATÓRIA, ela vai ser REAPROVEITADA na etapa 10 pelo ct-carrossel como slide integrado.
        |
[4] ct-redator -> escreve artigo MD
    - Base: clients/{slug}/templates/artigo.md
    - Segue o schema de post definido no repo do site do cliente
        |
[5] Skill(geo-content-optimizer) -> estrutura citavel, title, meta e perguntas e respostas; para SEO tecnico de site completo (schema, sitemap), plugin externo claude-seo
    - Title <=60 chars, meta <=160 chars, keyword no início
        |
[6] Skill(geo-content-optimizer) -> torna quotável pra AI (ChatGPT, Perplexity, AI Overviews)
    - Resposta direta nos 150 chars iniciais
    - FAQ schema, quotes com fontes, tabelas
        |
[7] Commit/push no repo do site do cliente (caminho em brand-profile.md)
    - Edita o arquivo de posts do blog (schema definido no repo)
    - Copia imagens pra public/assets/images/blog/{slug-artigo}/
    - Atualiza public/sitemap.xml
        |
[8] Aguardar deploy (~1-2 min, provedor definido no brand-profile.md)
        |
[9] Validar URL pública do artigo (domínio do cliente + /blog/{slug-artigo})
    - OG tags, schema JSON-LD, canonical
        |
[10] ct-carrossel -> gerar carrossel Instagram usando criativos do notebook
     - REAPROVEITA infográficos/slides/visuais gerados nas etapas 2-3
     - NÃO recria do zero
     - Destilação visual do artigo (formato social, mais curto)
     - REGRA OFICIAL: se o tema envolve dados estruturados (cronogramas/listas/grids/
       comparativos), INTEGRAR os infográficos produzidos na etapa 3 como SLIDES DO CARROSSEL
       (versão slide-inside-carousel 1080x1350). Não é mais "carrossel + infográfico separados",
       é carrossel COM slides-infográficos integrados, design system do cliente aplicado em todos os slides.
     - FORMATO ÚNICO: slides sempre 1080x1350
       - Salvar direto em content/{slug}/carousels/{slug-artigo}/slides/slide-0X.png
       - Sem subpastas vertical/ ou horizontal/
       - Script único: generate-slides.js (sem argumentos)
       - Infográficos (etapa 3) CONTINUAM em 2 formatos, só slides viraram único
        |
[11] ct-publicar-ig -> publicar carrossel no Instagram (AUTOMATIZADO via Graph API)
     - Registra em ct_content_items / ct_publications
        |
[12] ct-redator -> preparar post LinkedIn em arquivo TXT
     - Hook + contexto; o link do artigo vai no PRIMEIRO COMENTARIO (nao no corpo)
     - Salvar em content/{slug}/artigos/{slug-artigo}/post-linkedin.txt
     - Publicar so com "pode", pela ordem unica: API (se a marca tem app), navegador (Claude in Chrome), ou o usuario posta na Company Page (URL em brand-profile.md)
     - Sem API nao ha agendador: o horario vem do ct-social-intel/cockpit; o usuario pode usar o agendador nativo do LinkedIn
```

## Seção: Publicação do LinkedIn (ordem única)

Ler status e data da decisão em `clients/{slug}/brand-profile.md`. Ordem:

1. **API** (`skills/ct-publicar-li`) se a marca tiver o app LinkedIn configurado para o destino (perfil ou página).
2. **Navegador** (Claude in Chrome), só com "pode" explícito, pela rota descrita em `agents/ct-diretor.md` (Auto-LinkedIn).
3. **Manual**: Claude gera `post-linkedin.txt` (hook curto, contexto, pergunta final específica só se vier natural) e o usuário copia e posta na Company Page (URL em `brand-profile.md`).

Limites: enquanto a Community Management API não é aprovada, não há token/scope `w_organization_social`; sem a API não há agendador e Claude não agenda LinkedIn via cron. Não aguardar re-auth de token com scope organization.

## Entradas

- `tema` (obrigatório): sobre o que é o conteúdo
- `fontes_extras` (opcional): URLs adicionais pra NotebookLM
- `featured` (opcional, default false): destacar no blog

## Saídas esperadas

1. Notebook NotebookLM criado, `notebook_id` + `notebook_url` em `ct_notebooks`
2. Infográficos e cover em `content/{slug}/artigos/{slug-artigo}/criativos/` e no repo do site
3. Artigo publicado (commit/push no repo do site do cliente)
4. Sitemap.xml atualizado
5. Carrossel Instagram publicado (automático via Graph API)
6. `post-linkedin.txt` pronto (API, navegador com "pode" ou cópia manual)
7. Registro em `ct_content_items` vinculado ao `ct_notebooks.notebook_id`

## Delegação (agente responsável por etapa)

| Etapa | Agente | Skill/Ferramenta |
|-------|--------|------------------|
| 1. Pesquisa | ct-pesquisador | web-search + seo-research |
| 2. Notebook | ct-redator | Skill(notebooklm) |
| 3. Design | ct-designer | Aproveita visuais do notebook + design-system do cliente |
| 4. Artigo | ct-redator | Edit no arquivo de posts do repo do site |
| 5. SEO | ct-redator | Skill(geo-content-optimizer) |
| 6. GEO | ct-redator | Skill(geo-content-optimizer) |
| 7-9. Deploy | o usuario (revisão) | Commit/push + deploy |
| 10. Carrossel | ct-carrossel | carousel-generator (reaproveita criativos) |
| 11. Publicar IG | ct-social | ct-publicar-ig (Graph API) |
| 12. LinkedIn TXT | ct-redator | Arquivo TXT; publicação pela ordem única |

## Registro no banco

Ao final, inserir em `ct_content_items`:
```sql
INSERT INTO ct_content_items (client_slug, platform, content_type, title, status, external_url, metadata)
VALUES (
  '{slug}',
  'blog',
  'article',
  '{titulo}',
  'published',
  'https://{dominio-do-cliente}/blog/{slug-artigo}',
  jsonb_build_object(
    'notebook_id', '...',
    'ig_post_id', '...',
    'linkedin_status', 'manual_pending'
  )
);
```

## Regras críticas

1. **NÃO publicar sem aprovação explícita do usuario** (regra global)
2. **LGPD**: nunca citar clientes reais do cliente ativo sem autorização
3. **Posicionamento da marca** conforme o `brand-profile.md`
4. **Acentuação PT-BR** correta sempre
5. **Sem travessões**
6. **Artigo PRIMEIRO, depois IG**
7. **LinkedIn**: publicar só com "pode", pela ordem única (API se a marca tem app, navegador, manual); nunca prometer agendamento sem a API
8. **Instagram reaproveita criativos do notebook**, não recria do zero
9. **Sitemap.xml** atualizado junto com o artigo
10. **Notebook ID obrigatoriamente salvo** em `ct_notebooks` antes de avançar

## Regras críticas adicionais

### Encoding PT-BR (CRÍTICO)

Ao editar o arquivo de posts do site (ou qualquer arquivo do repo do cliente), SEMPRE:
- Preservar acentuação em PT-BR (caracteres UTF-8 nativos, NÃO escapados)
- Usar template literals com acentos diretos (ex: conteúdo, não a sequência escapada, não entidade HTML)
- Salvar arquivo em UTF-8 sem BOM
- Validar com grep que os acentos aparecem corretamente
- NUNCA copiar/colar texto que passou por filtro ASCII (remove acentos silenciosamente)

### Capa do artigo, ordem de prioridade

Priorizar capa nesta ordem:
1. **Infográfico NATIVO do NotebookLM** (se a UI/API gerou um, fica em `content/{slug}/artigos/{slug-artigo}/notebooklm/infograficos-nativos/`)
2. **Infográfico customizado** gerado pelo ct-designer (HTML+Playwright)
3. **Cover específica** gerada (se tema pedir)

Copiar escolhido pra `{site-repo}/public/assets/images/blog/{slug-artigo}/cover-{origem}.png` e apontar no campo de imagem de capa do post. Duplicar para `content/{slug}/artigos/{slug-artigo}/criativos/cover-artigo.png` como conveniência.

O mesmo cover serve de imagem de prévia no post LinkedIn (referenciar no topo do `post-linkedin.txt`).

## Formato plaintext pro editor LinkedIn (canônico)

Ao gerar `linkedin-article-plaintext.txt` (ou qualquer texto que o usuario vai colar no editor de artigos do LinkedIn), seguir EXATAMENTE este formato:

- Parágrafos separados por linha em branco simples
- Listas com "-" ou "1. 2. 3.", com linha em branco ENTRE os items (não só no fim da lista): LinkedIn renderiza cada item como parágrafo próprio
- Sem asteriscos, hashtags, travessões, hífens triplos ou qualquer markdown
- Subtítulos de seção como linhas únicas isoladas (linha em branco antes e depois), sem marcação
- URLs inline diretas no texto (não hyperlink markdown)
- Salvar em UTF-8 sem BOM
- Pergunta específica como última linha, só se vier natural do texto

Referência canônica: ver exemplo mais recente salvo em `content/{slug}/artigos/*/linkedin-article-plaintext.txt`.

## Pendências conhecidas

- [ ] Automatizar update do sitemap.xml (hoje manual)
- [ ] Validar tempo real de deploy (provedor do cliente)
- [ ] Criar script de "copiar criativos do notebook pro repo do site"
