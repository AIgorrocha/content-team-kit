# Loop de aprendizado (metodologia do kit)

Documento canonico do mecanismo de aprendizado do Content Team AI. Descreve como o framework
trata correcao de cliente como parte do metodo, nao como excecao. Complementa o `CLAUDE.md` da raiz.

## O principio

Toda correcao que um cliente da durante a producao de uma peca e tratada como um aprendizado,
nao como um ajuste pontual daquela peca.

O aprendizado sempre vira atualizacao na fonte DA MARCA que falhou:

- o perfil do cliente (`clients/{slug}/brand-profile.md`, `design-system.md`,
  `voice-patterns.md`);
- o arquivo de correcoes do cliente (`clients/{slug}/regras-cliente.md`). Instalacoes
  antigas podem indicar outro arquivo pela configuracao local.

Numa instalacao do kit, a correcao NUNCA edita `agents/` nem `skills/`. Esses arquivos sao do
kit e chegam prontos pela atualizacao (`ct-atualizar-kit`); se a pessoa os alterasse, a proxima
atualizacao daria conflito. A correcao vira regra da marca e pronto.

Se a correcao parecer valer para qualquer empresa (o erro e do proprio kit, nao da marca), o
agente oferece `ct-reportar-problema` como sugestao de melhoria. Quem decide mudar o kit e o
dono dele; a melhoria volta para todos na atualizacao seguinte.

Corrigir so a peca da vez, sem atualizar a fonte da marca, e tratado como erro de processo:
garante que o mesmo erro volta na proxima peca. A correcao so conta como resolvida quando a
fonte muda.

## Formato de cada correcao registrada

Cada correcao formalizada carrega tres partes:

1. **O que aconteceu**: o erro ou o pedido, com contexto minimo pra ser reconhecivel depois.
2. **A correcao aplicada**: o que mudou, e em qual arquivo (perfil de cliente ou
   arquivo de regras).
3. **Como aplicar da proxima vez**: a regra em si, verificavel antes de agir.

Selo de status por entrada:
- `[FIXA]` = regra permanente, ainda sem reincidencia registrada.
- `[REINCIDENTE]` = a mesma correcao ja foi necessaria mais de uma vez. Checar
  explicitamente antes de agir, sem excecao: a regra `[FIXA]` nao foi suficiente sozinha.

## Escopo: por cliente, nunca compartilhado

O aprendizado e escopado a `clients/{slug}/`. O que um cliente corrige nunca vaza pra outro
cliente do kit: voz, preferencia de formato e regra de processo sao proprias de cada cliente,
do mesmo jeito que a identidade visual e a marca sao proprias de cada um. Regra generica de
plataforma ou de mecanica (ex: `references/viral-playbook.md`, `platform-specs.md`) continua
compartilhada entre clientes; regra que nasceu de uma correcao de um cliente especifico, nao.

## Resultado pratico

Quanto mais pecas um cliente produz, menos correcoes repetidas ele precisa dar: a fonte que
falhou ja foi ajustada nas vezes anteriores. O sistema fica mais preciso PRA AQUELE CLIENTE
especificamente, sem exigir reconfiguracao manual recorrente e sem misturar aprendizado entre
clientes diferentes do mesmo kit.

## Exemplo

Uma correcao sobre legendas atualiza `clients/{slug}/design-system.md` e registra a regra
em `clients/{slug}/regras-cliente.md`, com selo `[REINCIDENTE]` ou `[FIXA]`.

## Onde comeca, pra cliente novo

Ao criar `clients/{slug}/` a partir de `clients/_template/`, o cliente novo ja recebe
`regras-cliente.md` vazio (template com instrucao de uso no topo). O loop comeca a valer desde
a primeira peca produzida: primeira correcao, primeira entrada no arquivo do cliente.
