function finiteValues(values) {
  return Array.isArray(values) ? values.filter(Number.isFinite) : [];
}

function mean(values) {
  const numbers = finiteValues(values);
  if (numbers.length === 0) return null;

  return numbers.reduce((total, value) => total + value, 0) / numbers.length;
}

function median(values) {
  const numbers = finiteValues(values).sort((left, right) => left - right);
  if (numbers.length === 0) return null;

  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2 === 0
    ? (numbers[middle - 1] + numbers[middle]) / 2
    : numbers[middle];
}

function sampleStdDev(values) {
  const numbers = finiteValues(values);
  if (numbers.length < 2) return null;

  const average = numbers.reduce((total, value) => total + value, 0) / numbers.length;
  const sumOfSquares = numbers.reduce(
    (total, value) => total + (value - average) ** 2,
    0
  );

  return Math.sqrt(sumOfSquares / (numbers.length - 1));
}

function pearson(xs, ys) {
  const pairCount = Math.min(
    Array.isArray(xs) ? xs.length : 0,
    Array.isArray(ys) ? ys.length : 0
  );
  const pairs = [];

  for (let index = 0; index < pairCount; index += 1) {
    if (Number.isFinite(xs[index]) && Number.isFinite(ys[index])) {
      pairs.push([xs[index], ys[index]]);
    }
  }

  if (pairs.length < 2) return { n: pairs.length, r: null };

  const meanX = pairs.reduce((total, [x]) => total + x, 0) / pairs.length;
  const meanY = pairs.reduce((total, [, y]) => total + y, 0) / pairs.length;
  let covariance = 0;
  let xVariance = 0;
  let yVariance = 0;

  for (const [x, y] of pairs) {
    const xDifference = x - meanX;
    const yDifference = y - meanY;
    covariance += xDifference * yDifference;
    xVariance += xDifference ** 2;
    yVariance += yDifference ** 2;
  }

  const denominator = Math.sqrt(xVariance * yVariance);
  if (denominator === 0) return { n: pairs.length, r: null };

  const r = covariance / denominator;
  return {
    n: pairs.length,
    r: Number.isFinite(r) ? Math.max(-1, Math.min(1, r)) : null,
  };
}

function iqrOutliers(values) {
  const numbers = finiteValues(values).sort((left, right) => left - right);
  if (numbers.length < 4) return null;

  const middle = Math.floor(numbers.length / 2);
  const lowerHalf = numbers.slice(0, middle);
  const upperHalf = numbers.slice(numbers.length % 2 === 0 ? middle : middle + 1);
  const firstQuartile = median(lowerHalf);
  const thirdQuartile = median(upperHalf);
  const interquartileRange = thirdQuartile - firstQuartile;
  const lowerFence = firstQuartile - 1.5 * interquartileRange;
  const upperFence = thirdQuartile + 1.5 * interquartileRange;

  return numbers.filter((value) => value < lowerFence || value > upperFence);
}

function sampleVerdict({ n, r } = {}) {
  if (!Number.isFinite(n)) return 'sem_dado_disponivel';
  if (n < 10) return 'amostra_insuficiente';
  if (!Number.isFinite(r)) return 'sem_dado_disponivel';
  if (n < 30) return 'sinal_descritivo';

  const absoluteCorrelation = Math.abs(r);
  if (absoluteCorrelation >= 0.5) return 'forte_para_hipotese';
  if (absoluteCorrelation >= 0.3) return 'moderada';
  return 'fraca';
}

function classifyCaption(caption) {
  if (typeof caption !== 'string') return 'outra';

  const nonEmptyLines = caption
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (nonEmptyLines.length === 1) return 'curta_uma_linha';

  const listItems = nonEmptyLines.filter((line) => /^(?:[-*•]|\d+[.)])\s+/.test(line));
  return listItems.length >= 3 ? 'longa_em_lista' : 'outra';
}

function durationBucket(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds <= 10) return '0_10s';
  if (seconds <= 30) return '10_30s';
  if (seconds <= 60) return '30_60s';
  return '60s_mais';
}

module.exports = {
  mean,
  median,
  sampleStdDev,
  pearson,
  iqrOutliers,
  sampleVerdict,
  classifyCaption,
  durationBucket,
};
