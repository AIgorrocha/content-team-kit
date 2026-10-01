/**
 * best-time-gate.cjs - Gate de amostra do best-time (REGRA DURA, skills/ct-social-cockpit/SKILL.md).
 *
 * Com sample_size < 20 o best-time NAO e recomendacao. Renderiza "AMOSTRA INSUFICIENTE (n=X)",
 * nunca "melhor horario: Xh", e nunca inventa nivel de confianca.
 *
 * Unico dono da regra. Quem renderiza best-time (cockpit build.js, briefing.js) chama daqui.
 * Self-check: node skills/_shared/best-time-gate.cjs
 */

const MIN_SAMPLE = 20;

function fmtFormat(f) {
  if (f.avg_rate != null) return `${f.avg_rate}%`;
  return `${f.avg_interactions} interacoes/post`;
}

/**
 * O n que decide o gate e SEMPRE o n do proprio corte (a celula), nunca o total da
 * plataforma. Ate 05/ago/2026 o horario era gateado por `sample_size` (total do periodo),
 * entao o Instagram publicava "Melhor horario: Ter 13h, base 30 posts" quando a celula
 * "Ter 13h" tinha n=1. Trinta posts espalhados em 7x24 celulas nao sao trinta amostras
 * de terca as 13h. `by_format` ja fazia certo; horario e dia agora fazem igual.
 *
 * Celula SEM `n` (payload velho) devolve null e conta como insuficiente: sem prova de
 * amostra nao ha recomendacao. Herdar o total era justamente o bug.
 */
function cellN(cell) {
  return cell && cell.n != null ? cell.n : null;
}

const insuficiente = (n) => n == null || n < MIN_SAMPLE;
const fmtN = (n) => (n == null ? 'desconhecido' : n);

/** Linhas markdown do bloco best-time de uma plataforma. payload = ct_social_insights.payload */
function bestTimeLines(payload) {
  const p = payload || {};
  const n = p.sample_size ?? 0;
  const L = [];

  const s = p.best_slots && p.best_slots[0];
  const sn = cellN(s);
  if (!s || insuficiente(sn)) {
    L.push(`- Melhor horario: AMOSTRA INSUFICIENTE (n=${fmtN(sn)}, minimo ${MIN_SAMPLE}). Nao usar como recomendacao.`);
  } else {
    L.push(
      `- Melhor horario: ${s.weekday} ${s.hour}h${s.avg_rate != null ? ` (${s.avg_rate}%)` : ''}` +
      ` · metrica: ${p.metric_used} · base: ${sn} posts nessa celula`
    );
  }

  const d = p.by_weekday && p.by_weekday[0];
  const dn = cellN(d);
  if (d) {
    if (insuficiente(dn)) {
      L.push(`- Melhor dia: AMOSTRA INSUFICIENTE (n=${fmtN(dn)}, minimo ${MIN_SAMPLE}). Nao usar como recomendacao.`);
    } else {
      L.push(`- Melhor dia: ${d.key} · base: ${dn} posts nesse dia`);
    }
  }
  const f = p.by_format && p.by_format[0];
  if (f) {
    const fn = cellN(f);
    L.push(`- Formato campeao: ${f.key} (${fmtFormat(f)}) · base: ${fmtN(fn)} posts` +
      (insuficiente(fn) ? ' · AMOSTRA INSUFICIENTE, nao usar como recomendacao' : ''));
  }
  return L;
}

/** Recomendacao pra briefing. null = amostra insuficiente, nao sugerir horario. */
function bestTimeRec(payload) {
  const p = payload || {};
  const n = p.sample_size ?? 0;
  const slot = p.best_slots && p.best_slots[0];
  const sn = cellN(slot);
  if (!slot || insuficiente(sn)) return null;
  const fmt = p.by_format && p.by_format[0];
  return {
    dia_hora: `${slot.weekday} ${slot.hour}h`,
    formato: fmt && !insuficiente(cellN(fmt)) ? fmt.key : '?',
    sample_size: sn,
  };
}

/**
 * Selo de amostra de QUALQUER corte (nao so best-time): formato, agente, tema.
 * null = n suficiente. String = o corte e descritivo, nao vira recomendacao.
 * Mesmo limiar do best-time de proposito: um dono so pra regra de amostra.
 */
function sampleNote(n) {
  return n >= MIN_SAMPLE ? null : `AMOSTRA INSUFICIENTE (n=${fmtN(n)}, minimo ${MIN_SAMPLE}): descritivo, nao recomendacao`;
}

module.exports = { MIN_SAMPLE, bestTimeLines, bestTimeRec, cellN, sampleNote };

if (require.main === module) {
  const assert = require('node:assert');
  const low = { sample_size: 1, metric_used: 'engagement_rate', best_slots: [{ weekday: 'Qua', hour: 16, avg_rate: 7.08, n: 1 }], by_weekday: [{ key: 'Qua', n: 1 }] };
  const lowOut = bestTimeLines(low).join('\n');
  assert.match(lowOut, /AMOSTRA INSUFICIENTE \(n=1/);
  assert.ok(!/Qua 16h/.test(lowOut), 'n<20 nao pode renderizar horario');
  assert.ok(!/Melhor dia: Qua/.test(lowOut), 'n<20 nao pode renderizar melhor dia');
  assert.strictEqual(bestTimeRec(low), null);

  // REGRESSAO REAL (Instagram, cockpit de ago/2026): total alto, celula minuscula.
  // O cockpit publicava "Melhor horario: Ter 13h · base: 30 posts" com n=1 na celula.
  // Trinta posts espalhados em 7x24 celulas nao sao trinta amostras de terca as 13h.
  const igReal = {
    sample_size: 30,
    metric_used: 'engagement_rate',
    best_slots: [{ weekday: 'Ter', hour: 13, avg_rate: 9.71, n: 1 }],
    by_weekday: [{ key: 'Dom', n: 3 }],
    by_format: [{ key: 'carousel_album', avg_rate: 6.89, n: 22 }],
  };
  const igOut = bestTimeLines(igReal).join('\n');
  assert.ok(!/Ter 13h/.test(igOut), 'celula com n=1 nao pode virar recomendacao de horario');
  assert.ok(!/Melhor dia: Dom/.test(igOut), 'dia com n=3 nao pode virar recomendacao');
  assert.match(igOut, /Melhor horario: AMOSTRA INSUFICIENTE \(n=1,/);
  assert.match(igOut, /Melhor dia: AMOSTRA INSUFICIENTE \(n=3,/);
  assert.ok(!/base: 30 posts/.test(igOut), 'nunca exibir o total da plataforma como base da celula');
  assert.strictEqual(bestTimeRec(igReal), null);

  const ok = {
    sample_size: 120,
    metric_used: 'engagement_rate',
    best_slots: [{ weekday: 'Ter', hour: 13, avg_rate: 9.76, n: 24 }],
    by_weekday: [{ key: 'Dom', n: 31 }],
    by_format: [{ key: 'carousel_album', avg_rate: 6.89, n: 22 }],
  };
  const okOut = bestTimeLines(ok).join('\n');
  assert.match(okOut, /Ter 13h \(9\.76%\).*base: 24 posts nessa celula/);
  assert.match(okOut, /Melhor dia: Dom · base: 31 posts nesse dia/);
  assert.ok(!/confian|conf\./i.test(okOut), 'nao inventar confianca');
  assert.strictEqual(bestTimeRec(ok).dia_hora, 'Ter 13h');
  assert.strictEqual(bestTimeRec(ok).sample_size, 24, 'a rec carrega o n da celula, nao o total');

  // Payload legado, sem n por celula: sem prova de amostra, nao recomenda.
  const semN = { sample_size: 30, metric_used: 'interactions', best_slots: [{ weekday: 'Qui', hour: 9 }], by_weekday: [{ key: 'Qui' }] };
  assert.match(bestTimeLines(semN).join('\n'), /Melhor horario: AMOSTRA INSUFICIENTE \(n=desconhecido,/);
  assert.strictEqual(bestTimeRec(semN), null);

  assert.match(bestTimeLines({}).join('\n'), /AMOSTRA INSUFICIENTE/);

  // sampleNote: mesmo limiar, usado pelos cortes do join (formato, agente, tema).
  assert.strictEqual(sampleNote(20), null);
  assert.match(sampleNote(3), /AMOSTRA INSUFICIENTE \(n=3, minimo 20\)/);
  assert.match(sampleNote(0), /AMOSTRA INSUFICIENTE \(n=0/);

  console.log('best-time-gate: OK');
}
