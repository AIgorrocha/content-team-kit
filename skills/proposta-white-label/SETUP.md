# Como instalar e configurar a skill "Proposta White-Label" (amostra grátis)

Gere propostas comerciais profissionais em HTML, na identidade visual certa, em
minutos. Funciona pra qualquer empresa: engenharia, marketing, software,
contabilidade, arquitetura, o que for. Roda na ferramenta de IA que você já usa.

**Funciona em:** Claude (claude.ai) · ChatGPT · Claude Code · Codex.

---

## O que você vai precisar
- Uma IA: **Claude, ChatGPT, Claude Code ou Codex**.
- O **arquivo da skill** (.zip com 4 arquivos).
- 10 minutos pra preencher o perfil da sua empresa (uma vez só).
- Conta na **Vercel** (grátis) pra publicar a proposta com link (Passo 4).

---

## Passo 1, Baixar a skill
Baixe o .zip e descompacte. Dentro tem 4 arquivos:
- `SKILL.md` (a metodologia)
- `company-profile.template.yaml` (o perfil da sua empresa)
- `SETUP.md` (este guia)
- `template/proposta-template.html` (o modelo visual)

## Passo 2, Instalar na sua IA
A skill é a mesma nas 4 ferramentas. Muda só onde você cola as instruções.

- **Claude Code ou Codex** (terminal): crie a pasta
  `.claude/skills/proposta-white-label/` na sua pasta de trabalho e cole os 4
  arquivos. Dica: peça pra própria IA "crie essa pasta e coloque estes arquivos".
- **Claude (claude.ai)**: crie um **Projeto**, cole o conteúdo de `SKILL.md` nas
  instruções do projeto e anexe o `company-profile.yaml` e o `template`.
- **ChatGPT**: crie um **GPT** (ou um Projeto), cole o `SKILL.md` nas instruções e
  suba o `company-profile.yaml` e o `template` nos arquivos.

## Passo 3, Configurar com os dados da sua empresa
Renomeie `company-profile.template.yaml` para `company-profile.yaml` e preencha:
- **empresa**: nome, o que faz, setor, site, WhatsApp e e-mail.
- **identidade**: `brand_mode: own` (proposta na sua marca, suas cores e logo) ou
  `client` (na marca do seu cliente, puxando as cores do site dele).
- **precificacao**: `mercado` (pesquisa e ancora o preço), `tabela` (seus preços
  por item) ou `por_hora`.
- **escopo**: seus serviços/módulos, o que inclui e o que não inclui.
- **descoberta**: as 6 perguntas que a IA faz pra entender o projeto (pode editar).
- **entregavel**: deixe `vercel` pra gerar link.

## Passo 4, Configurar a Vercel (obrigatório, pra gerar o link)
É a Vercel que transforma a proposta num link online pra mandar pro cliente. Grátis.
1. Crie conta em https://vercel.com/signup (pode entrar com Google/GitHub).
2. Instale a ferramenta: no terminal rode `npm i -g vercel`. (Sem Node? Instale em
   https://nodejs.org primeiro.)
3. Conecte sua conta: rode `vercel login` e confirme no navegador.
Faz isso uma vez. Depois toda proposta vira link automático.

## Passo 5, Gerar a proposta
Na sua IA, escreva:
```
Quero fazer uma proposta pra [cliente].
Contexto: [cole a transcrição da reunião, descreva o que ele precisa,
ou anexe os arquivos que ele te mandou].
```
A IA lê seu perfil, faz algumas perguntas (uma de cada vez), aplica a identidade
visual, calcula o preço, monta a proposta, publica na Vercel e te devolve o link.

## Passo 6, Revisar e enviar
Abra o link, confira valores e escopo, ajuste o que quiser ("muda o pagamento pra
3x", "tira a seção X"). Quando aprovar, **você** manda o link pro cliente. A skill
nunca envia sozinha.

---

## Perguntas comuns
- **Em qual ferramenta funciona?** Claude, ChatGPT, Claude Code e Codex.
- **Preciso saber programar?** Não. Você só conversa com a IA; ela faz o resto.
- **Funciona pro meu setor?** Sim. Nada é fixo de nenhum nicho; você define no perfil.
- **E o preço?** Você escolhe o método (mercado, tabela ou hora). No método mercado
  a IA valida o salário mínimo vigente antes de precificar.
- **Fica com a minha cara?** Sim. `brand_mode: own` usa sua marca; `client` usa a do
  seu cliente pra parecer feito sob medida.

## Suporte
Essa é a amostra grátis. Pra automatizar de ponta a ponta (CRM, follow-up,
multi-canal, time de agentes de conteúdo), fale com a gente sobre o Content Team AI.
