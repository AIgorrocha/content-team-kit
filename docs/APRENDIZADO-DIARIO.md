# Aprendizado diário do perfil

O time olha o Instagram da marca todo dia, registra o que saiu (inclusive o que você postou à mão),
mede o que deu certo e aprende a linguagem, os ganchos e os formatos. O resultado fica em
`clients/{marca}/aprendizado-do-perfil.md`, que todos os agentes leem antes de produzir.

Você não precisa de servidor nem de agendamento para usar. O caminho padrão é só abrir a pasta
do kit no assistente (Claude Code ou Codex): o aprendizado roda sozinho, uma vez por dia.

## O que o aprendizado pode mudar sozinho

Ao ligar o aprendizado diário, você autoriza a skill `ct-aprender-perfil` a:

- atualizar `clients/{marca}/aprendizado-do-perfil.md` (sempre);
- acrescentar linhas numa seção própria no fim de `voice-patterns.md` e de `regras-cliente.md`
  ("Aprendizado diário do perfil (automático)"), só com as travas abaixo.

Travas (texto completo em `skills/ct-aprender-perfil/SKILL.md`):

- só vira regra o padrão visto em 3 ou mais publicações dos últimos 30 dias, com desempenho
  mediano acima da mediana da conta (número medido, `[MEDIDO]`);
- nunca apaga: regra antiga contrariada fica no lugar e ganha "superada em DD/MM/AAAA";
- no máximo 3 mudanças por marca por dia, cada uma registrada no Histórico com o número que a justificou;
- regra sua (correções, `[FIXA]`, `[REINCIDENTE]`), `brand-profile.md` e `design-system.md` ficam intocáveis;
- o aprendizado vira regra da MARCA, nunca edição de `agents/` ou `skills/`.

Para desfazer um dia: diga "desfazer aprendizado de DD/MM" e a skill reverte as linhas daquela data.

## Como roda todo dia, sem servidor

### Opção 1 (padrão): ao abrir a pasta

Se a marca ativa tem Instagram conectado e o `aprendizado-do-perfil.md` está com "Atualizado em" de
antes de hoje, o assistente oferece rodar o aprendizado (na primeira vez) e, depois de você aceitar
ligar o aprendizado diário, roda `ct-aprender-perfil` antes de produzir e mostra o resumo na conversa.
Isso está no `CLAUDE.md` e no `AGENTS.md` do kit.

Você também pode pedir a qualquer momento: "aprender com o meu perfil" ou "o que está dando certo?".

### Opção 2 (opcional): tarefa agendada do Windows

Serve para o computador buscar os dados sozinho, mesmo sem você abrir o assistente. Duas tarefas
simples, no Agendador de Tarefas do Windows (programa já instalado no Windows):

1. **Registrar os posts do dia** e **ler os stories do dia** (os stories somem do ar em 24 horas,
   por isso vale rodar todo dia). Os dois comandos, nesta ordem, na pasta do kit:

   ```
   node scripts/sala/sync-publicacoes.mjs --rede instagram --dias 3
   node scripts/analytics/verify-daily-stories.mjs
   ```

   Para criar a tarefa de uma vez (abra o Prompt de Comando, troque o caminho pelo da pasta do kit
   e cole; roda todo dia às 21:00):

   ```
   schtasks /Create /SC DAILY /ST 21:00 /TN "Content Team registro do Instagram" /TR "cmd /c cd /d C:\caminho\do\kit && node scripts/sala/sync-publicacoes.mjs --rede instagram --dias 3 && node scripts/analytics/verify-daily-stories.mjs"
   ```

   Para apagar a tarefa: `schtasks /Delete /TN "Content Team registro do Instagram" /F`.

2. **Aprender com o perfil** (opcional, usa o Claude Code instalado no computador e a sua conta).
   Crie outra tarefa, 15 minutos depois da primeira, com o comando:

   ```
   schtasks /Create /SC DAILY /ST 21:15 /TN "Content Team aprendizado" /TR "cmd /c cd /d C:\caminho\do\kit && claude -p \"aprender com o meu perfil\""
   ```

   Sem esta segunda tarefa nada se perde: na próxima vez que você abrir a pasta, a Opção 1 faz o
   aprendizado do que ficou pendente.

Cuidados:
- O computador precisa estar ligado e com a sua sessão do Windows aberta no horário (ou a tarefa roda
  assim que possível, se você marcar "executar assim que possível" nas propriedades da tarefa).
- O registro de posts grava no banco local: o Docker (Supabase local) precisa estar aberto. Se não
  estiver, o comando só avisa e o aprendizado usa o que a API do Instagram devolve.
- Nada disso publica nem apaga coisa nenhuma. Chaves ficam só no `.env.local`.

## O que o coletor lê (somente leitura)

Comando: `node scripts/analytics/aprender-perfil-dados.mjs --cliente {marca} --dias 7 --base 30`
(sem `--cliente`, usa todas as contas configuradas ou a marca ativa).

| Dado | Fonte |
|---|---|
| Métricas do post (alcance, curtidas, comentários, compartilhamentos, salvos) | `ct_metrics_snapshots` (última coleta do `ig-daily-snapshot`); post de hoje sem coleta usa a API do Instagram |
| Legenda e horário real | API do Instagram (`/media`, somente leitura); sem token, `ct_content_items.caption` |
| Foi à mão? | Post sem registro em `ct_content_items` (pelo link ou, para item sem link, pelo horário) |
| Reel de teste (trial)? | `metadata.trial` do registro; `is_shared_to_feed=false` da API; por último o par da mesma legenda em até 24h |
| Stories | Leitura editorial do `verify-daily-stories` e métrica do `collect-story-insights` |

As contas vêm de `skills/_shared/ig-accounts.cjs` (conta principal e conta business da marca ativa).
Credencial ausente nunca é erro: a parte sem dado aparece como `AVISO:` na saída.

Comparação: cada post contra a mediana do mesmo formato (reel, carrossel, imagem) nos últimos 30 dias,
só com posts de pelo menos 2 dias (alcance ainda subindo não entra na base). Formato com menos de 3
posts usa a mediana geral.

### Reel de teste (trial reel)

Todo reel é publicado duas vezes: o normal e uma cópia como teste, só para não seguidores. O teste não
é duplicata. Ele fica fora das medianas e rankings do feed e tem grupo próprio (mediana de alcance dos
testes e a comparação de cada par normal x teste). Promover o teste é decisão sua, no app.

## Teste (somente leitura, sem rede)

```
node --test scripts/analytics/aprender-perfil-dados.test.mjs
```

## Limites conhecidos

- A API do Instagram não expõe a enquete dos stories e a leitura do texto na imagem é aproximada.
- `sync-publicacoes.mjs` usa `/media`, que não lista stories: os stories vêm do `verify-daily-stories` e do `collect-story-insights`.
- Alcance de post do dia ainda sobe: a leitura marca `[PARCIAL]` e a mediana só usa posts com 2 dias ou mais.
- Marca com poucos posts em 30 dias gera mediana com amostra pequena; a skill avisa e não muda regra.
