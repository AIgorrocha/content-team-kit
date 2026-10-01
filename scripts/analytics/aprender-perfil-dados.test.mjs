import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseArgs, mediana, formato, shortcode, fatosLegenda, ultimoPorPost, montarPosts, medianasBase,
  analisar, resumirStories, formatarTexto, inicioJanela,
} from './aprender-perfil-dados.mjs';

const AGORA = new Date('2026-10-01T01:30:00Z'); // 30/09 22:30 BRT

const snap = (id, tipo, pub, reach, extra = {}) => ({
  post_id: id, post_url: `https://www.instagram.com/${tipo === 'reel' ? 'reel' : 'p'}/${id}/`, post_type: tipo,
  published_at: pub, snapshot_date: '2026-10-01', reach, likes: 5, comments: 1, shares: 0, saves: 1, views: null, ...extra,
});

test('parseArgs: padroes e valores invalidos', () => {
  assert.deepEqual(parseArgs([]), { cliente: 'todos', dias: 1, base: 30, legendas: 14, json: false });
  const a = parseArgs(['--cliente', 'marca-b', '--dias', '7', '--json', '--base', 'x']);
  assert.equal(a.cliente, 'marca-b'); assert.equal(a.dias, 7); assert.equal(a.base, 30); assert.equal(a.json, true);
});

test('mediana, formato e shortcode', () => {
  assert.equal(mediana([3, 1, 2]), 2); assert.equal(mediana([1, 2, 3, 4]), 2.5); assert.equal(mediana([]), null);
  assert.equal(formato('VIDEO', 'REELS'), 'reel'); assert.equal(formato('CAROUSEL_ALBUM'), 'carrossel');
  assert.equal(formato('image'), 'imagem');
  assert.equal(shortcode('https://www.instagram.com/reel/Dc9bj9rCN_x/?igsh=1'), 'Dc9bj9rCN_x');
  assert.equal(shortcode('https://x.com/a/status/1'), null);
});

test('inicioJanela: 1 dia = hoje 00:00 BRT; 7 dias = 6 dias antes', () => {
  assert.equal(inicioJanela(AGORA, 1).toISOString(), '2026-09-30T03:00:00.000Z');
  assert.equal(inicioJanela(AGORA, 7).toISOString(), '2026-09-24T03:00:00.000Z');
});

test('fatosLegenda: tamanho, emoji, hashtag e pergunta', () => {
  const f = fatosLegenda('Voce usa IA?\nTeste agora\nO que acha? #ia #claude');
  assert.equal(f.hashtags, 2); assert.equal(f.fecha_com_pergunta, true); assert.equal(f.linhas, 3);
  assert.equal(fatosLegenda('oi 🚀').emojis, 1); assert.equal(fatosLegenda('  '), null);
});

test('ultimoPorPost: ultima coleta ganha, nulo herda da anterior', () => {
  const r = ultimoPorPost([
    { post_id: 'a', snapshot_date: '2026-09-30', reach: 10, caption: 'legenda' },
    { post_id: 'a', snapshot_date: '2026-10-01', reach: 20, caption: null },
  ]);
  assert.equal(r.length, 1); assert.equal(r[0].reach, 20); assert.equal(r[0].caption, 'legenda');
});

test('montarPosts: a mao x time (url e horario), legenda do item, banco fora = null', () => {
  const snaps = [snap('A1', 'reel', '2026-09-30T20:00:00Z', 100), snap('B2', 'reel', '2026-09-30T12:00:00Z', 50)];
  const itens = [{ publish_url: 'https://www.instagram.com/reel/A1/', published_at: '2026-09-30T20:02:00Z', caption: 'do item' }];
  const p = montarPosts({ snapshots: snaps, itens });
  const a = p.find((x) => x.id === 'A1'); const b = p.find((x) => x.id === 'B2');
  assert.equal(a.manual, false); assert.equal(a.legenda, 'do item');
  assert.equal(b.manual, true);
  assert.equal(montarPosts({ snapshots: snaps, itens: null })[0].manual, null);
  // item sem link: o horario salva o post de ser marcado como a mao
  const semLink = montarPosts({ snapshots: [snap('C3', 'reel', '2026-09-30T20:00:00Z', 5)], itens: [{ publish_url: null, published_at: '2026-09-30T20:10:00Z' }] });
  assert.equal(semLink[0].manual, false);
});

test('montarPosts: post so no Graph entra com curtidas e sem alcance', () => {
  const p = montarPosts({ snapshots: [], graph: [{ id: 'G1', caption: 'oi', media_type: 'VIDEO', media_product_type: 'REELS', timestamp: '2026-09-30T23:00:00Z', permalink: 'https://www.instagram.com/reel/G1/', like_count: 4, comments_count: 1 }], itens: [] });
  assert.equal(p[0].formato, 'reel'); assert.equal(p[0].alcance, null); assert.equal(p[0].interacoes, 5); assert.equal(p[0].manual, true);
});

test('analisar: compara com mediana do formato, ignora imaturos na base, top5 e piores5 sem repetir', () => {
  const snaps = [];
  for (let i = 0; i < 12; i++) snaps.push(snap(`R${i}`, 'reel', `2026-09-${String(5 + i).padStart(2, '0')}T15:00:00Z`, 10 * (i + 1)));
  snaps.push(snap('HOJE', 'reel', '2026-09-30T20:00:00Z', 500)); // do dia, parcial
  const posts = montarPosts({ snapshots: snaps, itens: [] });
  const r = analisar({ posts, agora: AGORA, dias: 1, base: 30 });
  assert.equal(r.posts_do_dia.length, 1);
  const hoje = r.posts_do_dia[0];
  assert.equal(hoje.parcial, true); assert.equal(hoje.ref_escopo, 'reel');
  assert.equal(hoje.ref_alcance, 65); // mediana de 10..120 (12 posts)
  assert.ok(hoje.vs_mediana_alcance > 7);
  assert.equal(r.top5.length, 5); assert.equal(r.piores5.length, 5);
  const ids = new Set(r.top5.map((p) => p.id));
  assert.ok(r.piores5.every((p) => !ids.has(p.id)));
  assert.ok(!r.top5.some((p) => p.id === 'HOJE'));
});

test('resumirStories: junta editorial e metrica crua pelo id', () => {
  const ed = [{ post_id: '__storyverify__:S1', snapshot_date: '2026-09-30', published_at: '2026-09-30T20:00:00Z', reach: 0, views: 11, comments: 0, metrics: { tipo: 'rotina', tema: 't', gancho: 'g', media_type: 'VIDEO' } }];
  const cru = [{ post_id: 'S1', snapshot_date: '2026-10-01', published_at: '2026-09-30T20:00:00Z', reach: 60, views: 90, comments: null, metrics: { replies: 3 } }];
  const s = resumirStories(cru, ed);
  assert.equal(s.length, 1); assert.equal(s[0].views, 90); assert.equal(s[0].respostas, 3); assert.equal(s[0].tipo, 'rotina');
});

test('formatarTexto: sem travessao, aviso sem dado e marca sem resultado', () => {
  const posts = montarPosts({ snapshots: [snap('X', 'reel', '2026-09-30T20:00:00Z', 30)], itens: [] });
  const txt = formatarTexto([
    { slug: 'marca-a', handle: 'h', avisos: [], resultado: analisar({ posts, agora: AGORA }) },
    { slug: 'marca-b', handle: null, avisos: ['banco: ausente'], resultado: null },
  ]);
  assert.ok(txt.includes('POSTS DO DIA (1)')); assert.ok(txt.includes('AVISO: banco: ausente'));
  assert.ok(!txt.includes(String.fromCharCode(0x2013)) && !txt.includes(String.fromCharCode(0x2014)));
  assert.equal(medianasBase([], { inicioBase: new Date(0), fimBase: new Date() }).geral.n, 0);
});

test('trial: par da mesma legenda em ate 24h (menor alcance = teste) sai das medianas e ganha grupo proprio', () => {
  const leg = { caption: 'A forma mais simples de controlar tarefas com IA. Texto longo igual.' };
  const snaps = [
    snap('N1', 'reel', '2026-09-21T17:02:00Z', 171, leg),
    snap('T1', 'reel', '2026-09-21T17:04:00Z', 40, leg),
    snap('U1', 'reel', '2026-09-22T17:04:00Z', 50, { caption: 'outra legenda' }),
  ];
  const posts = montarPosts({ snapshots: snaps, itens: [] });
  const t1 = posts.find((p) => p.id === 'T1');
  assert.equal(t1.trial, true); assert.equal(t1.trial_origem, 'legenda'); assert.ok(t1.par_de.includes('N1'));
  assert.equal(posts.find((p) => p.id === 'N1').trial, false);
  const r = analisar({ posts, agora: AGORA, dias: 1, base: 30, legendas: 30 });
  assert.equal(r.trials_fora_do_feed, 1);
  assert.equal(r.medianas.reel.n, 2); // N1 e U1
  assert.equal(r.legendas.length, 2);
  assert.equal(r.trials.n, 1); assert.equal(r.trials.mediana_alcance, 40);
  assert.deepEqual(r.trials.pares.map((x) => [x.normal_alcance, x.trial_alcance, x.razao_trial_normal]), [[171, 40, 0.23]]);
  const semana = analisar({ posts, agora: AGORA, dias: 30 });
  assert.ok(semana.posts_do_dia.some((p) => p.id === 'T1' && p.trial && p.ref_escopo === 'trial')); // aparece no dia, marcado
  const txt = formatarTexto([{ slug: 'x', handle: null, avisos: [], resultado: semana }]);
  assert.ok(txt.includes('REELS DE TESTE (trial)') && txt.includes('par normal x teste: normal 171, teste 40'));
  assert.ok(!/duplicata/i.test(txt));
});

test('trial: registro (metadata.trial) e Graph (is_shared_to_feed=false) vencem a regra da legenda', () => {
  const snaps = [snap('R1', 'reel', '2026-09-21T17:02:00Z', 10, { caption: 'legenda a' }), snap('R2', 'reel', '2026-09-21T17:03:00Z', 99, { caption: 'legenda b' })];
  const itens = [{ publish_url: 'https://www.instagram.com/reel/R1/', published_at: '2026-09-21T17:02:00Z', metadata: { trial: true } }];
  const graph = [{ id: 'R2', permalink: 'https://www.instagram.com/reel/R2/', timestamp: '2026-09-21T17:03:00Z', media_type: 'VIDEO', media_product_type: 'REELS', caption: 'legenda b', is_shared_to_feed: false }];
  const p = montarPosts({ snapshots: snaps, graph, itens });
  assert.equal(p.find((x) => x.id === 'R1').trial_origem, 'registro');
  assert.equal(p.find((x) => x.id === 'R2').trial_origem, 'graph'); // mesmo com alcance maior
  // reel com legenda unica e sem marca nenhuma: normal
  assert.equal(montarPosts({ snapshots: [snap('S1', 'reel', '2026-09-21T17:02:00Z', 5)], itens: [] })[0].trial, false);
  // carrossel com mesma legenda nao vira trial (trial so existe para reel)
  const c = montarPosts({ snapshots: [snap('C1', 'carousel', '2026-09-21T17:00:00Z', 5, { caption: 'x' }), snap('C2', 'carousel', '2026-09-21T18:00:00Z', 9, { caption: 'x' })], itens: [] });
  assert.ok(c.every((x) => !x.trial));
});
