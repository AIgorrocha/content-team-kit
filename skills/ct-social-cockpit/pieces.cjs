/**
 * pieces.cjs - JOIN entre a peca que NOS produzimos e o desempenho real dela.
 *
 *   ct_content_items.publish_url  x  ct_metrics_snapshots.post_url
 *
 * A chave existia desde sempre e nunca tinha sido usada. Normalizacao de URL mora em
 * skills/_shared/post-key.cjs (dono unico); o gate de amostra mora em best-time-gate.cjs.
 * Aqui so tem o casamento e a renderizacao.
 *
 * REGRAS DE REDACAO (o cockpit e lido por agente, nao por analista):
 *   - metrica ausente escreve "sem dado", NUNCA 0. 0 e medicao, ausencia nao e.
 *   - corte com n < MIN_SAMPLE sai com selo de amostra insuficiente e nao vira recomendacao.
 *   - nunca dizer que um atributo CAUSA alcance. So "nas N pecas observadas, X aparece junto de".
 */

const { postKey, indexByKey, lookup } = require('../_shared/post-key.cjs');
const { sampleNote } = require('../_shared/best-time-gate.cjs');

const num = (v) => (v == null || v === '' ? null : Number(v));
const fmt = (v) => (v == null ? 'sem dado' : v);

function interactions(s) {
  const parts = [s.likes, s.comments, s.shares, s.saves].map(num).filter((v) => v != null);
  return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
}

/** tema/pilar da peca. Nao existe coluna: o que houver no metadata, senao "nao registrado". */
function theme(item) {
  const m = item.metadata || {};
  return m.pillar || m.content_group || m.serie || m.folder || m.slug || 'nao registrado';
}

/**
 * Casa as nossas pecas publicadas com a ultima medicao de cada uma.
 * rest(pathQ) = fetcher PostgREST ja autenticado (o build.js tem o dele).
 */
async function joinPieces(rest, client) {
  const items = await rest(
    `ct_content_items?client_slug=eq.${client}&status=eq.published` +
    `&select=id,title,content_type,platform,published_at,publish_url,source_agent,metadata` +
    `&order=published_at.desc&limit=1000`
  );
  const snaps = await rest(
    `ct_metrics_snapshots?client_slug=eq.${client}&grain=eq.post&post_url=not.is.null` +
    `&select=post_url,post_type,published_at,snapshot_date,reach,impressions,likes,comments,shares,saves,views,engagement_rate` +
    `&order=snapshot_date.desc&limit=1000`
  );

  // snapshot mais recente por peca (a lista ja vem em ordem decrescente de snapshot_date)
  const index = indexByKey(snaps);

  const rows = [];
  const semUrl = [];
  const urlInvalida = [];
  const casados = new Set();
  const stories = [];
  for (const it of items) {
    // Story do IG nao tem permalink publico e a metrica dele chega agregada por dia
    // (post_type=story_daily_agg, post_url null). Nao da pra casar por URL, nao e falha de
    // registro: sai do join e e contado a parte. Desempenho de Story vem por outro caminho.
    if (it.content_type === 'story') { stories.push(it); continue; }
    if (!it.publish_url) { semUrl.push(it); continue; }
    const k = postKey(it.publish_url);
    if (!k || k.startsWith('igmedia:')) { urlInvalida.push(it); continue; }
    const s = lookup(index, k) || null;
    if (s) casados.add(s);
    rows.push({
      title: it.title,
      formato: it.content_type || s?.post_type || null,
      tema: theme(it),
      agente: it.source_agent || 'nao registrado',
      data: (it.published_at || '').slice(0, 10) || null,
      plataforma: it.platform,
      url: it.publish_url,
      medido: !!s,
      reach: s ? num(s.reach) : null,
      shares: s ? num(s.shares) : null,
      saves: s ? num(s.saves) : null,
      engagement_rate: s ? num(s.engagement_rate) : null,
      interacoes: s ? interactions(s) : null,
    });
  }

  // peca medida que nao tem registro nosso: o lado do problema que nao e URL, e falta de INSERT.
  // Conta pelas linhas casadas (o LinkedIn casa por proximidade, entao a chave nao bate igual).
  const medidosSemRegistro = index.size - casados.size;

  return {
    client,
    total_publicadas: items.length,
    com_medicao: rows.filter((r) => r.medido).length,
    sem_url: semUrl.length,
    sem_url_titulos: semUrl.map((i) => `${(i.published_at || '').slice(0, 10)} ${i.title}`),
    stories: stories.length,
    url_invalida: urlInvalida.map((i) => i.publish_url),
    medidos_sem_registro: medidosSemRegistro,
    total_medidos: index.size,
    rows,
  };
}

/** Corte por atributo, ordenado por alcance medio. Metrica ausente nao entra na media. */
function cut(rows, keyOf, metric) {
  const g = {};
  for (const r of rows) {
    const k = keyOf(r) || 'nao registrado';
    (g[k] = g[k] || { key: k, n: 0, vals: [] }).n++;
    if (r[metric] != null) g[k].vals.push(r[metric]);
  }
  return Object.values(g)
    .map((x) => ({
      key: x.key, n: x.n, n_medido: x.vals.length,
      media: x.vals.length ? Number((x.vals.reduce((a, b) => a + b, 0) / x.vals.length).toFixed(2)) : null,
    }))
    .sort((a, b) => (b.media ?? -1) - (a.media ?? -1));
}

function cutLines(label, arr, unidade) {
  const L = [`- Por ${label}:`];
  for (const c of arr) {
    const nota = sampleNote(c.n_medido);
    L.push(`  - ${c.key}: ${c.media == null ? 'sem dado' : `${c.media} ${unidade}`}` +
      ` · pecas: ${c.n} (com medicao: ${c.n_medido})` + (nota ? ` · ${nota}` : ''));
  }
  return L;
}

/** Bloco markdown "Desempenho das nossas pecas" do cockpit.md. */
function piecesLines(d) {
  const L = ['## Desempenho das nossas pecas'];
  L.push('> JOIN ct_content_items.publish_url x ct_metrics_snapshots.post_url. ' +
    'Metrica ausente aparece como "sem dado", nunca como 0. ' +
    'Corte com amostra insuficiente e DESCRITIVO: descreve o que apareceu junto, nao prova causa.');
  L.push('');
  L.push(`- Pecas publicadas registradas: ${d.total_publicadas} · com desempenho medido: ${d.com_medicao}` +
    ` · sem publish_url: ${d.sem_url} · com URL que nao casa: ${d.url_invalida.length}` +
    ` · Stories (sem permalink, fora do join por mecanica): ${d.stories}`);
  if (d.sem_url) L.push(`  - Sem link (publicadas fora do registro, invisiveis pro aprendizado): ${d.sem_url_titulos.join(' | ')}`);
  L.push(`- Posts medidos na conta sem peca registrada: ${d.medidos_sem_registro} de ${d.total_medidos}` +
    ' (publicados fora do registro, fora do aprendizado)');
  if (d.url_invalida.length) L.push(`  - URLs invalidas (id de midia, nao permalink): ${d.url_invalida.join(' ')}`);
  L.push('');

  const medidas = d.rows.filter((r) => r.medido);
  if (!medidas.length) {
    L.push('- Nenhuma peca nossa cruzou com medicao ainda. Sem base pra qualquer leitura de desempenho.');
    L.push('');
    return L;
  }

  const ord = [...medidas].sort((a, b) => (b.reach ?? b.interacoes ?? -1) - (a.reach ?? a.interacoes ?? -1));
  L.push(`- Pecas medidas (${medidas.length}), da maior pra menor:`);
  for (const r of ord.slice(0, 15)) {
    L.push(`  - ${r.data || 'sem data'} [${r.formato || 'sem formato'}/${r.plataforma}] ${(r.title || '').slice(0, 70)}`);
    L.push(`    tema: ${r.tema} · produziu: ${r.agente} · alcance: ${fmt(r.reach)}` +
      ` · shares: ${fmt(r.shares)} · saves: ${fmt(r.saves)} · engaj: ${r.engagement_rate == null ? 'sem dado' : r.engagement_rate + '%'}` +
      ` · interacoes: ${fmt(r.interacoes)}`);
  }
  L.push('');
  const metric = medidas.some((r) => r.reach != null) ? 'reach' : 'interacoes';
  L.push(`- Cortes por ${metric === 'reach' ? 'alcance medio' : 'interacoes medias'} (a metrica com dado):`);
  cutLines('formato', cut(medidas, (r) => r.formato, metric), metric).forEach((l) => L.push(l));
  cutLines('agente que produziu', cut(medidas, (r) => r.agente, metric), metric).forEach((l) => L.push(l));
  cutLines('tema/pilar', cut(medidas, (r) => r.tema, metric), metric).forEach((l) => L.push(l));
  L.push('');
  return L;
}

module.exports = { joinPieces, piecesLines, cut, theme };

if (require.main === module) {
  const assert = require('node:assert');
  const rest = async (q) => {
    if (q.startsWith('ct_content_items')) return [
      { title: 'Reel A', content_type: 'reel', platform: 'instagram', published_at: '2026-08-04T18:33:08Z',
        publish_url: 'https://www.instagram.com/reel/AbcDefGhi12/', source_agent: 'ct-video-editor', metadata: { pillar: 'ia' } },
      { title: 'Post LI', content_type: 'post', platform: 'linkedin', published_at: '2026-07-22T13:00:03Z',
        publish_url: 'https://www.linkedin.com/feed/update/urn:li:share:7000000060939640832', source_agent: 'ct-redator', metadata: {} },
      { title: 'Reel publicado a mao, link nunca colado', content_type: 'reel', platform: 'instagram',
        published_at: '2026-07-29T12:00:00Z', publish_url: null, source_agent: 'ct-diretor', metadata: {} },
      { title: 'Story 5 telas', content_type: 'story', platform: 'instagram', published_at: '2026-07-29T18:00:00Z',
        publish_url: null, source_agent: 'ct-story', metadata: {} },
      { title: 'Url de media id', content_type: 'post', platform: 'instagram', published_at: '2026-06-01T12:00:00Z',
        publish_url: 'https://www.instagram.com/p/17900000000000001/', source_agent: null, metadata: {} },
    ];
    return [
      { post_url: 'https://www.instagram.com/p/AbcDefGhi12/', snapshot_date: '2026-08-05', reach: 900, shares: 7, saves: null, likes: 10, comments: 4, engagement_rate: 3.2 },
      { post_url: 'urn:li:activity:7000000062365753344', snapshot_date: '2026-08-05', reach: null, likes: 20, comments: 2 },
      { post_url: 'https://www.instagram.com/p/OUTROPOST01/', snapshot_date: '2026-08-05', reach: 100 },
    ];
  };

  (async () => {
    const d = await joinPieces(rest, 'acme');
    assert.strictEqual(d.com_medicao, 2, 'reel (permalink /p/ x /reel/) e LinkedIn (share x activity) tem que casar');
    assert.strictEqual(d.sem_url, 1, 'peca sem link conta como fora do registro');
    assert.strictEqual(d.stories, 1, 'Story sai do join por mecanica, nao entra em sem_url');
    assert.deepStrictEqual(d.url_invalida, ['https://www.instagram.com/p/17900000000000001/']);
    assert.strictEqual(d.medidos_sem_registro, 1, 'post medido sem peca registrada tem que ser contado');

    const out = piecesLines(d).join('\n');
    assert.match(out, /alcance: 900/);
    assert.match(out, /saves: sem dado/, 'metrica ausente e "sem dado", nunca 0');
    assert.ok(!/saves: 0/.test(out), 'nunca preencher ausencia com zero');
    assert.match(out, /AMOSTRA INSUFICIENTE/, 'corte com n<20 sai com selo');
    assert.ok(!/\b(causa|gera|garante) (mais )?(alcance|engajamento)/i.test(out),
      'nunca redigir correlacao como causa');
    assert.match(out, /nao prova causa/, 'o bloco tem que avisar que e descritivo');

    // Corte de formato: n conta pecas, n_medido conta as que tem a metrica.
    const c = cut(d.rows.filter((r) => r.medido), (r) => r.formato, 'reach');
    assert.strictEqual(c.find((x) => x.key === 'reel').media, 900);
    assert.strictEqual(c.find((x) => x.key === 'post').media, null, 'sem dado de alcance nao vira 0');
    console.log('pieces: OK');
  })();
}
