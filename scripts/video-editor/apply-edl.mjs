// apply-edl.mjs - funcoes puras pra aplicar uma EDL (lista de DROPs) no timeline.
// Usado pelo run-editor quando cutMode inclui "llm". Sem efeito colateral (testavel).

// keep-segments = complemento dos drops dentro de [0, dur]. Retorna [[s,e],...].
export function keepSegments(drops, dur) {
  const ds = [...drops].filter((d) => d.end > d.start).sort((a, b) => a.start - b.start);
  const keeps = [];
  let cursor = 0;
  for (const d of ds) {
    const s = Math.max(0, d.start), e = Math.min(dur, d.end);
    if (s > cursor) keeps.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < dur) keeps.push([cursor, dur]);
  return keeps.filter(([s, e]) => e - s > 0.02); // ignora cacos < 20ms
}

// remap de tempo antigo -> novo (apos remover os drops). t em drop colapsa pro
// inicio do proximo keep. Alem do fim, retorna duracao total mantida.
export function makeRemap(keeps) {
  const total = keeps.reduce((s, [a, b]) => s + (b - a), 0);
  return function remap(t) {
    let acc = 0;
    for (const [s, e] of keeps) {
      if (t < s) return +acc.toFixed(3);
      if (t <= e) return +(acc + (t - s)).toFixed(3);
      acc += e - s;
    }
    return +Math.min(acc, total).toFixed(3);
  };
}

// remapeia o WhisperX (audio.json) pro novo timeline. Remove palavras dentro de drop.
// Devolve novo objeto no mesmo formato (1 segmento com todas as palavras).
export function remapWhisperX(raw, keeps) {
  const remap = makeRemap(keeps);
  const inDrop = (t) => !keeps.some(([s, e]) => t >= s - 1e-6 && t <= e + 1e-6);
  const out = [];
  for (const seg of raw.segments || []) {
    for (const w of seg.words || []) {
      if (typeof w.start !== "number" || typeof w.end !== "number") continue;
      const mid = (w.start + w.end) / 2;
      if (inDrop(mid)) continue; // palavra cortada
      out.push({ ...w, start: remap(w.start), end: remap(w.end) });
    }
  }
  const text = out.map((w) => (w.word || "").trim()).join(" ");
  return { segments: [{ start: out.length ? out[0].start : 0, end: out.length ? out[out.length - 1].end : 0, text, words: out }] };
}

// remapeia o layout (fromSec/toSec) pro novo timeline. Sentinela grande (>=99) vira newDur.
export function remapLayout(layout, keeps, newDur) {
  const remap = makeRemap(keeps);
  return layout
    .map((s) => ({
      ...s,
      fromSec: remap(s.fromSec),
      toSec: s.toSec >= 99 ? newDur : remap(s.toSec),
    }))
    .filter((s) => s.toSec - s.fromSec > 0.05); // descarta segmento que colapsou
}

// monta o filter_complex do ffmpeg pra cortar (trim+concat) em UM encode.
export function ffmpegConcatFilter(keeps) {
  const parts = [];
  keeps.forEach(([s, e], i) => {
    parts.push(`[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}]`);
    parts.push(`[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${i}]`);
  });
  const labels = keeps.map((_, i) => `[v${i}][a${i}]`).join("");
  parts.push(`${labels}concat=n=${keeps.length}:v=1:a=1[v][a]`);
  return parts.join(";");
}
