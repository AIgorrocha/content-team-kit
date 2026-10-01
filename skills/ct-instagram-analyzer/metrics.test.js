/**
 * metrics.test.js - Check executavel do coletor de metricas do Instagram.
 *
 * Existe por causa de um cego real: entre jun e ago/2026 o coletor pedia `plays` (metrica
 * removida da API) em REELS e VIDEO. A API rejeita a requisicao inteira quando UM nome e
 * invalido, e o erro era engolido. Resultado: 740 linhas de reel gravadas com reach, views,
 * shares e saves zerados. Dado de alcance de reel nao e recuperavel depois, entao a perda
 * foi permanente.
 *
 * Este teste FALHA se o coletor voltar a nao pedir as metricas que sustentam toda decisao
 * de formato (reach, views, shares, saves) e a retencao de reel (ig_reels_avg_watch_time).
 *
 * Rodar: node skills/ct-instagram-analyzer/metrics.test.js
 */

const assert = require('node:assert');
const { METRICS_BY_TYPE, metricsFor } = require('./analyze.js');

// O reel e o formato principal das duas contas. Sem estas cinco, ele e cego.
const OBRIGATORIAS_REEL = ['reach', 'views', 'saved', 'shares', 'ig_reels_avg_watch_time'];
for (const m of OBRIGATORIAS_REEL) {
  assert.ok(
    METRICS_BY_TYPE.REELS.includes(m),
    `REELS precisa pedir "${m}". Sem isso o reel volta a ser cego em ct_metrics_snapshots.`
  );
}

// Alcance e o denominador de tudo: nenhum tipo pode ficar sem.
for (const [tipo, lista] of Object.entries(METRICS_BY_TYPE)) {
  assert.ok(lista.includes('reach'), `${tipo} precisa pedir "reach".`);
}

// Carrossel e imagem tambem sustentam corte de formato e o sinal de send/save.
for (const tipo of ['CAROUSEL_ALBUM', 'IMAGE']) {
  for (const m of ['reach', 'saved', 'shares']) {
    assert.ok(METRICS_BY_TYPE[tipo].includes(m), `${tipo} precisa pedir "${m}".`);
  }
}

// `impressions` foi removida da Media Insights API e `plays` virou `views`.
// Pedir qualquer uma das duas derruba o lote inteiro de novo.
for (const [tipo, lista] of Object.entries(METRICS_BY_TYPE)) {
  assert.ok(!lista.includes('impressions'), `${tipo} nao pode pedir "impressions" (removida da API).`);
  assert.ok(!lista.includes('plays'), `${tipo} nao pode pedir "plays" (substituida por "views").`);
}

// Roteamento: reel e identificado por media_product_type, nao por media_type.
assert.deepStrictEqual(metricsFor({ media_product_type: 'REELS', media_type: 'VIDEO' }), METRICS_BY_TYPE.REELS);
assert.deepStrictEqual(metricsFor({ media_type: 'CAROUSEL_ALBUM' }), METRICS_BY_TYPE.CAROUSEL_ALBUM);
assert.deepStrictEqual(metricsFor({ media_type: 'IMAGE' }), METRICS_BY_TYPE.IMAGE);
assert.deepStrictEqual(metricsFor({ media_type: 'ALGO_NOVO' }), ['reach']);

console.log('ct-instagram-analyzer/metrics: OK');
