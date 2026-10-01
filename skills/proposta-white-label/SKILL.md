---
name: proposta-white-label
description: "Gera propostas comerciais personalizadas em HTML standalone pra QUALQUER empresa, a partir de um company-profile.yaml. Extrai a identidade visual (sua ou do prospect), faz descoberta guiada, precifica por mercado/tabela/hora (valida salário mínimo), monta a proposta na identidade certa e entrega um link. Amostra grátis do Content Team AI. 100% parametrizável: nenhuma marca, preço ou setor é fixo."
---

# Proposta White-Label: gerador de propostas pra qualquer empresa

Versão GLOBAL e parametrizável do gerador de propostas. Mesma metodologia usada em
produção (análise forense + descoberta guiada + ancoragem de preço + HTML na marca),
mas SEM nada fixo de nenhuma empresa. Tudo vem de `company-profile.yaml`.

> Distribuída como **amostra grátis** do Content Team AI. Auto-contida: não depende
> de banco de dados, servidor proprio nem de nenhuma infra interna.

## Pré-requisito (1 vez)
1. Copiar `company-profile.template.yaml` -> `company-profile.yaml` e preencher.
2. (Opcional) Node + `npx vercel` se for publicar online. Senão, gera HTML local.
3. Ver `SETUP.md` pro passo a passo completo.

## Como invocar
"Quero fazer uma proposta pra {prospect}" + (transcrição da reunião / arquivos /
briefing). A skill lê o `company-profile.yaml` e segue o fluxo.

## Fluxo (10 passos)

### 1. Carregar o perfil da empresa
Ler `company-profile.yaml`. Dali saem: marca, método de preço, escopo padrão,
perguntas de descoberta, contato, formato de entrega. NADA é assumido fora disso.

### 2. Capturar contexto do prospect
Ler tudo que o usuário trouxe (transcrição, PDFs, planilhas, site do prospect).
Se vazio, seguir direto pra descoberta guiada (passo 4).

### 3. Análise (números reais, nunca estimados)
Ler arquivo por arquivo, aba por aba. Contar o que dá pra contar (áreas, itens,
volumes). Listar gaps. Cruzar números oficiais quando houver. Sem inventar.

### 4. Descoberta guiada (BMAD leve)
Seguir `descoberta.perguntas` do profile. **1 pergunta por vez**, validar a
resposta antes da próxima. Default = 6 perguntas (problema, público, urgência,
métricas, escopo/fases, estrutura comercial). Registrar as decisões confirmadas.

### 5. Identidade visual (conforme brand_mode)
- `brand_mode: client` -> extrair a marca do PROSPECT: abrir `site`/Instagram dele
  com Playwright, `getComputedStyle()` pras cores dominantes, screenshot pra
  confirmar, pegar logo. Mapear pros tokens CSS.
- `brand_mode: own` -> usar `identidade.cores` + `logo` do profile.
- **Fallback obrigatorio:** se `client` e a extracao falhar (prospect sem site,
  Playwright indisponivel, cores ilegiveis) -> usar `identidade.cores` do profile e
  avisar o usuario. Nunca travar o fluxo por causa da marca.
Tokens CSS alvo: `--brand`, `--brand2`, `--bg`, `--txt`, `--muted`, `--accent`.
Validar contraste: se o fundo extraido for claro, escurecer `--muted`/`--txt` pra
manter legibilidade (WCAG).

### 6. Pesquisa de preço (conforme precificacao.metodo)
- `mercado` -> WebSearch: quanto custa esse escopo no mercado do `setor`/`pais`.
  Se `validar_salario_minimo` -> buscar SM vigente do país (impacta custo de mão de obra).
- `tabela` -> aplicar `precificacao.tabela` (item × base × valor).
- `por_hora` -> `valor_hora` × horas estimadas do escopo.
Sempre que `mostrar_balizamento_mercado` -> apresentar o valor de mercado ANTES do
preço final (ancoragem: cliente vê o quanto economiza).
Notas: a validação de salário mínimo só roda no método `mercado`. Para `tabela` e
`por_hora`, FECHAR o escopo (passo 7) ANTES de calcular o preço (o valor depende
dos itens/horas). Usar a `moeda` do profile no símbolo de todos os valores.

### 7. Definir escopo e estrutura comercial
Combinar `escopo.modulos`/`inclusos`/`nao_inclusos` do profile com o que a descoberta
revelou. Estrutura por `modelo_comercial` (projeto único / ondas / recorrente / misto)
e `forma_pagamento_default` (ajustável por proposta).

### 8. Montar o HTML standalone (na identidade do passo 5)
Usar `template/proposta-template.html` (CSS por variáveis = troca de marca é só
trocar tokens). Substituir TODOS os `{{TOKEN}}`. Conferir no fim que não sobrou
nenhum `{{...}}` cru no HTML.

**Tokens do template e de onde vêm:**
| Origem | Tokens |
|--------|--------|
| company-profile (marca) | COR_PRIMARIA, COR_SECUNDARIA, COR_FUNDO, COR_TEXTO, COR_ACENTO, FONTE_TITULO, FONTE_TEXTO |
| company-profile (empresa) | EMPRESA_NOME, EMPRESA_TAGLINE, WHATSAPP, EMAIL, AGENDAMENTO, ANO |
| Gerados por proposta (a IA preenche) | PROSPECT_NOME, TITULO_PROPOSTA, TIPO_SERVICO, RESUMO_HERO, BADGES, CTA_LINK, CTA_TEXTO, ENTENDIMENTO_TITULO/TEXTO, CARDS_ENTENDIMENTO, CARDS_ESCOPO, VALOR_TITULO/TEXTO, CARDS_BENEFICIOS, INVEST_TITULO, BALIZAMENTO_MERCADO, TABELA_PRECOS, PILLS_PRECO, INCLUSOS, NAO_INCLUSOS, TIMELINE |

Tokens `CARDS_*`, `BADGES`, `TABELA_PRECOS`, `PILLS_PRECO`, `INCLUSOS`,
`NAO_INCLUSOS`, `TIMELINE` recebem BLOCOS de HTML (não valores). `CTA_LINK`/`CTA_TEXTO`
default = WhatsApp do profile (`https://wa.me/<WHATSAPP>` / "Falar no WhatsApp").

**Cuidados que evitam HTML quebrado:**
- Fontes Google: trocar espaço por `+` na URL (ex: `Open Sans` -> `Open+Sans`).
- `WHATSAPP`: só dígitos (sem `+`, espaço, parênteses).
- Links vazios (`AGENDAMENTO` sem valor): usar `#` pra não quebrar.

Seções: Capa/Hero, Entendimento, O que entregamos (módulos), Por que vale (ROI),
Balizamento de mercado, Investimento, Inclusos/Não-inclusos, Forma de pagamento,
Cronograma (timeline CSS, NUNCA Mermaid gantt), Contato/CTA.
Se `sem_travessao` -> não usar travessão em nenhum texto.

### 9. Entregar (conforme entregavel)
- `deploy: vercel` -> `npx vercel deploy --prod --yes` -> URL pública.
- `deploy: nenhum` -> salvar `index.html` local e abrir no navegador.

### 10. Fechar
Entregar o link/arquivo + um resumo (escopo, valor, prazo). Lembrar: revisar antes
de enviar pro prospect. Publicação é sempre manual.

## Regras (white-label)
- NADA hardcoded: marca, preço, setor, disciplinas e contato vêm do `company-profile.yaml`.
- Preço sempre DEPOIS do valor (mostrar balizamento de mercado primeiro).
- Cronograma = timeline HTML/CSS, nunca Mermaid gantt.
- 1 pergunta por vez na descoberta; validar antes de avançar.
- Sem travessão (-) se `sem_travessao: true`.
- Não expor stack interno do usuário em peça que vai pro prospect.
- Números contados dos arquivos, nunca estimados no escuro.

## Arquivos da skill
- `SKILL.md` (este), metodologia.
- `company-profile.template.yaml`: parâmetros da empresa (copiar e preencher).
- `SETUP.md`: passo a passo de configuração pro usuário final.
- `template/proposta-template.html`: template HTML tokenizado por marca.
