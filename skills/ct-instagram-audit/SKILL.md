---
name: ct-instagram-audit
description: "Gera uma auditoria quantitativa reproduzivel da conta propria do cliente ativo no Instagram a partir do snapshot do ct-instagram-analyzer."
---

# ct-instagram-audit

## Quando usar

- Para auditar os posts já coletados da conta própria do cliente ativo (handle em `clients/{slug}/brand-profile.md`).
- Para revisar distribuição por formato, duração, legenda, dia e hora, tendência mensal, comentários e outliers.
- Para gerar um relatório de pesquisa reproduzível antes de uma decisão editorial.

## Fonte de dados

O comando consome um JSON gerado por `ct-instagram-analyzer` no formato:

```json
{
  "handle": "{handle-do-cliente}",
  "fetched_at": "2026-08-20T00:00:00.000Z",
  "media": []
}
```

Colete ou atualize o snapshot antes de auditar:

```powershell
node skills/ct-instagram-analyzer/analyze.js --account {slug-do-cliente}
```

O dado de entrada bruto deve representar métricas realmente devolvidas pela Graph API. Este skill não estima alcance, views, salvamentos, compartilhamentos, comentários ou duração. Campo ausente permanece como `sem dado disponível` no relatório.

Para uma release reproduzível, gere uma evidência sanitizada versionada. Ela conserva somente IDs, tipos, timestamps, contagens necessárias, classe de legenda, durações medidas e metadados de cadeia de custódia. Ela não contém texto de legenda, permalink, URL de mídia, paginação, query string ou credencial.

## Uso

Para usar o snapshot mais recente da conta do cliente ativo:

```powershell
npm.cmd run audit:instagram:{slug-do-cliente}
```

O comando procura o arquivo mais recente em `output/instagram-analyzer/{handle}-*.json` e grava `content/research/<data>-{slug}-instagram-audit.md`.

Para informar arquivos explicitamente:

```powershell
node skills/ct-instagram-audit/audit.cjs --input output/instagram-analyzer/{handle}-2026-08-20.json --output content/research/2026-08-20-{slug}-instagram-audit.md
```

Para produzir a evidência a partir do snapshot bruto local, informe uma data de medição UTC explícita. Com entradas idênticas e a mesma data de medição, o JSON gerado é determinístico.

```powershell
node skills/ct-instagram-audit/evidence.cjs --input output/instagram-analyzer/{handle}-2026-08-20.json --output content/research/evidence/2026-08-20-{slug}-instagram-audit-evidence.json --measured-at <ISO-8601-UTC>
```

Para reproduzir a release sem o snapshot bruto, sem rede e sem `ffprobe`:

```powershell
node skills/ct-instagram-audit/audit.cjs --input content/research/evidence/2026-08-20-{slug}-instagram-audit-evidence.json --output content/research/2026-08-20-{slug}-instagram-audit.md --limit 90 --time-zone America/Sao_Paulo
node skills/ct-instagram-audit/verify-evidence.cjs --input content/research/evidence/2026-08-20-{slug}-instagram-audit-evidence.json --report content/research/2026-08-20-{slug}-instagram-audit.md --limit 90
```

## Medição de duração

Para cada item `VIDEO` bruto sem uma duração explícita em `options.durationsById`, o comando usa `ffprobe` na `media_url` para medir a duração real. Cada sonda tem limite de 15.000 ms. O comando preserva valores explícitos e nunca estima um valor ausente. Se a URL estiver expirada, indisponível, não responder dentro do limite ou retornar uma saída inválida, a duração permanece como `sem dado disponível` e entra na contagem de limitações.

Uma evidência sanitizada válida traz `durations_by_id` completo, inclusive valores nulos para as medições indisponíveis, e classes de legenda pré-calculadas. Nesse modo a auditoria valida schema, contagens e IDs antes de calcular, não usa texto de legenda e não chama `ffprobe`.

Consumidores programáticos devem usar `await run(...)`, pois a sonda de `ffprobe` é assíncrona e `run` retorna uma Promise. Eles podem informar `durationTimeoutMs` em `options`; somente inteiros positivos e seguros de até 2.147.483.647 ms substituem o padrão. Valor inválido usa os 15.000 ms. A CLI mantém o padrão e não oferece essa alteração por argumento.

## Leitura do relatório

- Toda linha de tabela inclui `n`, o número de evidências daquela linha.
- Correlação de duração exibe `r`, `n` e o veredito de amostra.
- Correlação não prova causalidade.
- Tendência mensal só aparece quando existem pelo menos três meses com cinco posts com views válidas por mês.
- Outliers usam IQR e não constituem recomendação por si sós.

## Limites deste skill

- Esta fase cobre somente a conta própria do cliente ativo no Instagram.
- Não publica, nem modifica bio, destaques, links ou site.
- Não lê nem armazena credenciais.
- O comando mede duração real somente para itens `VIDEO` que tenham `media_url`. Valores explícitos em `options.durationsById` são preservados.
- A evidência aceita somente o schema `ct-instagram-audit-evidence/v1`, IDs consistentes e durações finitas não negativas ou nulas. Artefato malformado falha fechado.
