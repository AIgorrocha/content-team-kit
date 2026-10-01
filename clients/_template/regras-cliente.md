# Regras do cliente {slug} (pedidos permanentes)

> Como usar este template: copie para `clients/{slug}/regras-cliente.md` ao criar um cliente
> novo (junto com `brand-profile.md` e `design-system.md`). Este arquivo comeca vazio. Cada
> agente que produzir pra este cliente deve ler aqui ANTES de produzir e escrever aqui toda vez
> que o cliente corrigir algo.

Documento canonico dos pedidos e correcoes do cliente `{slug}` que valem pra SEMPRE, nao so pra
tarefa em que foram ditos. Toda vez que o cliente corrigir algo, a correcao entra aqui E na
fonte que falhou (skill, agente, `brand-profile.md`, `design-system.md`). Documentar aqui sem
corrigir a fonte nao resolve: a fonte errada e o que faz o erro se repetir.

Este arquivo e escopado a `clients/{slug}/`. Nunca copiar regra daqui pra outro cliente do kit,
e nunca importar regra de outro cliente pra ca: cada cliente tem o proprio historico de
correcao, do mesmo jeito que tem a propria voz.

Precedencia: `brand-profile.md` > `design-system.md` > este documento > references genericas do
framework. Regra de cliente sempre manda sobre regra generica.

Legenda de status:
- `[REINCIDENTE]` = erro ja cometido mais de uma vez. Checar ANTES de agir, sem excecao.
- `[FIXA]` = regra permanente, ainda sem reincidencia registrada.

---

## 1. Midia e qualidade

(sem entradas ainda)

## 2. Voz e texto

(sem entradas ainda)

## 3. Publicacao e aprovacao

(sem entradas ainda)

## 4. Fatos e dados do cliente

(sem entradas ainda)

---

## Como registrar uma correcao nova

1. Identificar a fonte que falhou: skill do agente, `brand-profile.md`, `design-system.md`, ou
   um passo de processo que nao existe em nenhum arquivo ainda.
2. Corrigir a fonte primeiro.
3. Adicionar uma entrada aqui na categoria certa, com: o que aconteceu, a correcao aplicada, e
   como aplicar da proxima vez. Comecar com `[FIXA]`.
4. Se a mesma correcao for necessaria de novo, trocar o selo pra `[REINCIDENTE]` e reforcar a
   regra (ela nao estava clara o suficiente da primeira vez).
