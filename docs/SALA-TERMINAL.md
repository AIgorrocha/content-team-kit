# Ligar o terminal ao kanban da Sala (Trabalho)

A tela `/sala/trabalho` mostra o que cada agente esta fazendo agora (esperando,
trabalhando, aguardando aprovacao, concluido hoje). Quem alimenta essa tela e o
script `scripts/sala/hook-forward.mjs`, chamado pelo terminal de cada CLI toda
vez que algo acontece (comeca um pedido, um agente termina, o turno encerra).

Este guia so mostra os trechos prontos pra colar. Nenhum arquivo fora deste
repositorio e editado automaticamente: colar e' sempre uma acao manual, feita
por voce, no arquivo de configuracao da sua propria CLI.

Em todo trecho abaixo, troque `<pasta-do-repo>` pelo caminho completo desta
pasta no seu computador (o mesmo que aparece na barra de titulo do terminal
quando voce esta aqui dentro).

## Claude Code

Ja funciona. Os hooks estao em `.claude/settings.json` deste repositorio (nao
em um arquivo pessoal seu) e valem a partir da proxima sessao nova do Claude
Code aberta nesta pasta. Nada a fazer.

## Codex CLI

O Codex tem uma opcao chamada `notify`: um programa que ele chama sozinho toda
vez que termina um turno. Abra `~/.codex/config.toml` (arquivo pessoal seu, o
Codex cria se nao existir) e adicione:

```toml
notify = ["node", "<pasta-do-repo>/scripts/sala/hook-forward.mjs", "--familia", "codex"]
```

O Codex manda o proprio evento (fim de turno) como argumento pro programa. O
script identifica sozinho que veio do Codex e registra "turno concluido" no
kanban, sem guardar o texto da conversa.

## Kimi Code CLI

O Kimi Code tambem tem hooks, configurados em `~/.kimi-code/config.toml`
(arquivo pessoal seu). Cada bloco `[[hooks]]` liga um evento a um comando. Cole
um bloco por evento que quiser acompanhar (os quatro cobrem o ciclo inteiro:
pedido, inicio de agente, fim de agente, fim de turno):

```toml
[[hooks]]
event = "UserPromptSubmit"
command = "node <pasta-do-repo>/scripts/sala/hook-forward.mjs"

[[hooks]]
event = "SubagentStart"
command = "node <pasta-do-repo>/scripts/sala/hook-forward.mjs"

[[hooks]]
event = "SubagentStop"
command = "node <pasta-do-repo>/scripts/sala/hook-forward.mjs"

[[hooks]]
event = "Stop"
command = "node <pasta-do-repo>/scripts/sala/hook-forward.mjs"
```

Nao precisa do `--familia kimi`: o script reconhece o formato do Kimi Code
sozinho (o JSON dele tem o campo `event` em vez de `hook_event_name`). So use
`--familia kimi` se algum dia o Kimi mudar o formato e o reconhecimento
automatico parar de funcionar.

## Grok

O Grok Build (ou o `grok-delegation`) nao tem um hook oficial ainda. Quem
registra o evento e' o proprio comando que inicia ou termina a tarefa do Grok,
chamando o script direto na linha de comando (sem entrada por stdin):

```bash
node <pasta-do-repo>/scripts/sala/hook-forward.mjs --familia grok --evento agente_iniciou --agente grok-build --tarefa "revisar diff da entrega"
node <pasta-do-repo>/scripts/sala/hook-forward.mjs --familia grok --evento agente_concluiu --agente grok-build --tarefa "revisou diff da entrega"
```

`--evento` aceita os mesmos nomes que aparecem no kanban: `agente_iniciou`,
`agente_concluiu`, `aprovacao_pedida`, `aprovado`, `publicado`, `erro`, entre
outros. `--tarefa` e' o texto curto que aparece no cartao: escreva um resumo,
nunca o prompt inteiro. `--modelo` e' opcional (ex.: `--modelo grok-4.6`).

## Como saber se esta funcionando

Depois de colar o trecho e reiniciar a CLI correspondente, rode uma tarefa
qualquer nela e olhe `/sala/trabalho` na Sala rodando local
(`npm run sala:dev:local`). Um cartao novo deve aparecer na coluna
"Trabalhando" e mudar de coluna quando a tarefa terminar.

Se nada aparecer, confira duas coisas no `.env.local` deste repositorio (sem
imprimir o valor em lugar nenhum): `SALA_HOOK_TOKEN` precisa estar preenchido,
e `SALA_URL` precisa apontar pro endereco onde a Sala esta rodando
(`http://localhost:5056` quando voce usa `npm run sala:dev:local` na porta
padrao). Sem o token, o evento fica guardado em
`output/sala-hook-queue.jsonl` esperando a proxima chamada com token valido,
em vez de aparecer na tela.
