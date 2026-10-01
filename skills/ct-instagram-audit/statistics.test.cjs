const assert = require('node:assert/strict');
const {
  mean,
  median,
  sampleStdDev,
  pearson,
  iqrOutliers,
  sampleVerdict,
  classifyCaption,
  durationBucket,
} = require('./statistics.cjs');

const descriptiveValues = [100, 110, 120, 130, 1000];

assert.equal(mean(descriptiveValues), 292);
assert.equal(median(descriptiveValues), 120);
assert.ok(Number.isFinite(sampleStdDev(descriptiveValues)));
assert.ok(Math.abs(sampleStdDev(descriptiveValues) - Math.sqrt(156770)) < 1e-12);
assert.equal(median([100, 110, 120, 130]), 115);

assert.equal(mean([100, null, Number.NaN, Infinity, -Infinity, 120]), 110);
assert.equal(median([100, null, Number.NaN, Infinity, -Infinity, 120]), 110);
assert.ok(Math.abs(sampleStdDev([100, Number.NaN, 120]) - Math.sqrt(200)) < 1e-12);

assert.equal(mean([null, Number.NaN, Infinity]), null);
assert.equal(median([null, Number.NaN, Infinity]), null);
assert.equal(sampleStdDev([120]), null);

assert.deepEqual(
  iqrOutliers([100, 105, 110, 115, 120, 125, 130, 1000]),
  [1000]
);
assert.equal(iqrOutliers([100, null, Number.NaN]), null);

assert.deepEqual(
  pearson([1, 2, null, 3, Number.NaN], [10, 20, 30, 30, 40]),
  { n: 3, r: 1 }
);
assert.deepEqual(pearson([1, 2, 3], [30, 20, 10]), { n: 3, r: -1 });
assert.deepEqual(pearson([1, null], [10, 20]), { n: 1, r: null });
assert.deepEqual(pearson([1, 1, 1], [10, 20, 30]), { n: 3, r: null });

assert.equal(sampleVerdict(), 'sem_dado_disponivel');
assert.equal(sampleVerdict({ n: null, r: 0.9 }), 'sem_dado_disponivel');
assert.equal(sampleVerdict({ n: Number.NaN, r: 0.9 }), 'sem_dado_disponivel');
assert.equal(sampleVerdict({ n: Infinity, r: 0.9 }), 'sem_dado_disponivel');
assert.equal(sampleVerdict({ n: 9, r: 0.9 }), 'amostra_insuficiente');
assert.equal(sampleVerdict({ n: 10, r: null }), 'sem_dado_disponivel');
assert.equal(sampleVerdict({ n: 10, r: Number.NaN }), 'sem_dado_disponivel');
assert.equal(sampleVerdict({ n: 29, r: 0.9 }), 'sinal_descritivo');
assert.equal(sampleVerdict({ n: 30, r: 0.5 }), 'forte_para_hipotese');
assert.equal(sampleVerdict({ n: 30, r: -0.5 }), 'forte_para_hipotese');
assert.equal(sampleVerdict({ n: 30, r: 0.3 }), 'moderada');
assert.equal(sampleVerdict({ n: 30, r: 0.49 }), 'moderada');
assert.equal(sampleVerdict({ n: 30, r: -0.29 }), 'fraca');

assert.equal(classifyCaption('\nLegenda em uma linha\n'), 'curta_uma_linha');
assert.equal(classifyCaption('- Primeiro\n- Segundo\n- Terceiro'), 'longa_em_lista');
assert.equal(classifyCaption('1. Primeiro\n2. Segundo\n3. Terceiro'), 'longa_em_lista');
assert.equal(
  classifyCaption('Primeiro parágrafo.\n\nSegundo parágrafo com explicação.'),
  'outra'
);
assert.equal(classifyCaption(null), 'outra');

assert.equal(durationBucket(0), '0_10s');
assert.equal(durationBucket(10), '0_10s');
assert.equal(durationBucket(10.01), '10_30s');
assert.equal(durationBucket(30), '10_30s');
assert.equal(durationBucket(30.01), '30_60s');
assert.equal(durationBucket(60), '30_60s');
assert.equal(durationBucket(60.01), '60s_mais');
assert.equal(durationBucket(-1), null);
assert.equal(durationBucket(Number.NaN), null);

console.log('ct-instagram-audit/statistics: OK');
