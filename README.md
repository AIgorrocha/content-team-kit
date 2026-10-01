# Content Team AI

Um time de conteúdo com 25 agentes de IA que roda no seu computador, dentro do Claude Code
ou do Codex. Você descreve a sua marca uma vez. Depois o time pesquisa, escreve, monta
carrossel, story, reel e artigo, adapta para cada rede e só publica quando você aprova.

## Antes de começar

Você só precisa do Claude Code ou do Codex instalado, com **uma assinatura sua** (cada pessoa
ou empresa usa a própria conta, nunca a de quem passou o kit). O resto o assistente faz
conversando com você, pedindo permissão a cada passo.

1. **Baixar o kit:** crie uma pasta vazia, abra o Claude Code (ou o Codex) nela e diga
   **"baixar o kit"** (ou siga `docs/COMO-RECEBER-ATUALIZACOES.md`).
2. **Configurar:** diga **"configurar empresa nova"**. O assistente prepara o computador
   (instala o que faltar), faz as perguntas uma por vez (público, tom de voz, cores, redes,
   concorrentes), lê o seu site e as suas redes, **mostra prévias** de legenda, carrossel,
   reel e story para você escolher o estilo, e monta a pasta da marca em `clients/sua-marca/`.
   Se parar no meio, diga **"continuar configuração"**.
3. **Conectar as redes (opcional):** diga **"conectar as redes"**. O assistente abre o
   navegador e te guia tela por tela; você digita login e senha você mesmo. Sem conectar, o
   time produz os arquivos e você publica à mão.
4. **Guardar a sua marca (recomendado):** diga **"criar meu repositório privado"**. O
   assistente cria uma cópia privada na sua conta do GitHub (gratuita), só sua. Sem isso, a
   marca fica só neste computador e se perde se ele quebrar.

Instalação passo a passo, para quem prefere fazer à mão: `docs/SETUP.md`. Baixar, atualizar
e guardar a marca, com botões: `docs/COMO-RECEBER-ATUALIZACOES.md`.

## Quem vê o quê

- Este endereço público tem só o kit genérico, sem marca de ninguém. Ninguém consegue enviar
  nada para ele, só baixar.
- A sua marca (perfil, cores, peças, regras) fica no seu computador e, se você criar, no seu
  repositório privado. Nem quem mantém o kit nem outras empresas veem.
- Chaves e senhas ficam só no arquivo `.env.local`, que nunca sai do seu computador. O
  assistente nunca pede senha no chat: ele diz o nome da chave e você cola o valor no arquivo.

## Atualizações, problemas e sugestões

- **"atualizar o kit"**: traz as melhorias novas, mostra antes o que muda e nunca mexe na sua marca.
- **"reportar problema"** ou **"sugerir melhoria"**: monta um aviso sem senhas nem dados da
  marca, mostra o texto e só envia com o seu "pode". O aviso chega como Issue (aviso) em
  https://github.com/AIgorrocha/content-team-kit/issues. Sem conta no GitHub, o assistente
  entrega o texto para você mandar por WhatsApp ou e-mail a quem te passou o kit.

## Como pedir as coisas

Converse em português normal. Alguns exemplos:

| Você escreve | O que acontece |
|---|---|
| "planeja a semana" | Monta o calendário da semana com pautas por rede |
| "faz um carrossel sobre [tema]" | Texto, slides na identidade da marca e legenda |
| "cria uma sequência de stories sobre [tema]" | Roteiro de 3 a 5 telas |
| "transforma esse vídeo em reel" | Corte, legenda automática e capa |
| "adapta esse post pro LinkedIn e pro TikTok" | Uma versão por rede, no formato de cada uma |
| "pesquisa o que os concorrentes estão postando" | Relatório com padrões e ideias |
| "como foram os posts da semana?" | Resumo das métricas e o que repetir |
| "audita a minha conta de anúncios" | Nota de 0 a 100 da conta Meta Ads e plano de ação |
| "publica" | Só depois de você ver a peça e responder "pode" |
| "clona a estrutura deste vídeo viral com o nosso produto" | Mesmo formato do vídeo de referência, com o conteúdo da sua marca (ferramenta externa opcional) |
| "atualizar o kit" | Traz as melhorias novas sem mexer na sua marca |
| "reportar problema" | Monta um aviso para quem mantém o kit, sem senhas nem dados da marca |
| "avaliar essa ferramenta: [link]" | Parecer de licença, segurança e utilidade antes de instalar qualquer coisa |
| "o que você sabe fazer?" | Lista tudo o que o time faz |

Quem recebe o pedido é o **Diretor** (`agents/ct-diretor.md`). Ele distribui o trabalho para
o agente certo (redator, designer, carrossel, vídeo, pesquisador e outros).

Ferramentas extras recomendadas (opcionais): `docs/SKILLS-EXTERNAS.md`.

## Regras que o time sempre segue

- **Nada é publicado sem o seu "pode".**
- A sua marca manda: o que está em `clients/sua-marca/` vale mais do que qualquer regra geral.
- Toda correção que você fizer vira regra permanente da marca (`clients/sua-marca/regras-cliente.md`),
  para o erro não voltar. Detalhe em `docs/LOOP-DE-APRENDIZADO.md`.
- Chaves e senhas ficam só no arquivo `.env.local`, que nunca deve ser compartilhado.

## Onde ficam as coisas

| Pasta | O que tem |
|---|---|
| `clients/` | Uma pasta por marca: perfil, identidade visual, concorrentes, regras. Modelo em `clients/_template/` |
| `content/` | As peças prontas, por marca e por formato (criada no primeiro uso) |
| `agents/` | Os 25 agentes (as "funções" do time) |
| `skills/` | As receitas passo a passo que os agentes seguem |
| `references/` | Guias de gancho, retenção, formatos e algoritmo de cada rede |
| `docs/` | Instalação, integrações e guias técnicos (índice em `docs/README.md`) |
| `wiki/` | Explicação de como o sistema funciona, agente por agente |
| `src/`, `scripts/`, `supabase/`, `remotion/` | Código do painel, automações, banco e vídeo |

## Painel

`npm run dev` abre a Sala de Comando no navegador (`http://localhost:5000`): peças, calendário,
métricas e o que cada agente está fazendo. Detalhe em `docs/SETUP.md`, passo 5.

## Avisos e limitações conhecidas

- **Remotion (motor de vídeo por código):** gratuito para pessoas e empresas pequenas;
  empresas acima de um certo tamanho precisam da licença paga deles. Detalhe em
  `THIRD-PARTY-NOTICES.md`.
- **Ferramentas externas** (Hypit, HeyGen, Higgsfield e outras) são opcionais, instaladas à
  parte e algumas são pagas. Lista em `docs/SKILLS-EXTERNAS.md`.
- **Login do Instagram:** a Meta às vezes recusa o endereço `localhost` no retorno do login.
  O caminho alternativo está em `references/conexoes-guiadas.md`.
- **Edição de vídeo com rosto** (cortes e legenda automática) precisa do programa de
  transcrição WhisperX instalado. Passo a passo em `docs/CT_VIDEO_EDITOR.md`; peça
  "instalar o editor de vídeo" e o assistente faz com você.
- A publicação de verdade em cada rede depende das suas chaves. Antes de publicar pela
  primeira vez, faça um teste e confira a peça na rede. Se algo falhar, diga "reportar problema".

## Licença

MIT (`LICENSE`). Partes de terceiros e a licença do Remotion para empresas: `THIRD-PARTY-NOTICES.md`.
