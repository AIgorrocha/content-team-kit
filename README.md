# Content Team AI

Um time de conteúdo com 25 agentes de IA que roda no seu computador, dentro do Claude Code
ou do Codex. Você descreve a sua marca uma vez. Depois o time pesquisa, escreve, monta
carrossel, story, reel e artigo, adapta para cada rede e só publica quando você aprova.

## Antes de começar

Você só precisa do Claude Code ou do Codex instalado. O resto o assistente faz conversando
com você, pedindo permissão a cada passo.

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

Instalação passo a passo, para quem prefere fazer à mão: `docs/SETUP.md`.

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

## Licença

MIT (`LICENSE`). Partes de terceiros e a licença do Remotion para empresas: `THIRD-PARTY-NOTICES.md`.
