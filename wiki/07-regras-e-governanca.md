# Regras e governanca

## Regras de cada marca

Pedidos permanentes e correcoes de cada marca ficam em
`clients/{slug}/regras-cliente.md` (modelo em `clients/_template/regras-cliente.md`).
Regra marcada `[REINCIDENTE]` ja se repetiu antes: conferir explicitamente
antes de agir. Como uma correcao vira regra: `docs/LOOP-DE-APRENDIZADO.md`.

## Status de evidencia do viral-playbook

Toda regra de `references/viral-playbook.md` carrega um selo:

| Status | Significa |
|---|---|
| `[MEDIDO]` | Tem dado real das contas da marca, com numero e fonte |
| `[MECANICA]` | Decorre de como a plataforma funciona, verificavel na propria UI/doc |
| `[HIPOTESE]` | Veio de fonte externa ou opiniao, ainda sem validacao nas contas da marca |

Regra sem selo e invalida, nao seguir.

## Regra do link publicado (publish_url)

Toda peca publicada precisa entrar no registro (`ct_content_items`) com o link
real (`publish_url`). Sem isso a peca nao cruza com a metrica dela
(`ct_metrics_snapshots`) e some do cockpit e do aprendizado dos agentes.
Conferir com `npm run check:join`.
