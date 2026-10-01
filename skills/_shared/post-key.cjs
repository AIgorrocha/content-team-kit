/**
 * post-key.cjs - Chave canonica de UMA peca publicada. Dono unico da normalizacao de URL.
 *
 * Existe pra casar as DUAS pontas que ja existiam e nunca se falaram:
 *   ct_content_items.publish_url  (o que NOS produzimos)
 *   ct_metrics_snapshots.post_url (como aquilo performou)
 *
 * Quem grava URL de peca (publisher) e quem le (join do cockpit, check) chamam daqui.
 * Nao reimplementar regex de URL em outro arquivo.
 *
 * Self-check: node skills/_shared/post-key.cjs
 */

// Tolerancia do casamento do LinkedIn, em ms. Ver linkedInMs() abaixo.
const LI_TOLERANCE_MS = 5000;

/**
 * LinkedIn nao tem uma chave estavel entre as duas pontas:
 *   - o publisher recebe `urn:li:share:7000000060939640832`
 *   - o analyzer raspa      `urn:li:activity:7000000062365753344`
 * Sao ids DIFERENTES da mesma peca, sem conversao aritmetica.
 * Os dois ids sao snowflake: os bits acima de 22 sao o timestamp em ms da criacao.
 * Nos 3 pares reais conferidos (jul/2026) share e activity ficaram a 260-340 ms um do outro.
 * Entao o casamento do LinkedIn e por PROXIMIDADE de timestamp (5s), nunca por igualdade.
 * ponytail: se algum dia o publisher souber o activity urn, isso vira igualdade e some daqui.
 */
function linkedInMs(id) {
  try { return Number(BigInt(id) >> 22n); } catch { return null; }
}

/**
 * Chave canonica. Devolve string ou null (nao da pra casar).
 *   ig:<shortcode>   igmedia:<id>   li:<ms>   tt:<id>   yt:<id>   x:<id>
 *
 * `igmedia:` e proposital: URL de Instagram montada com o ID DE MIDIA da Graph API
 * (`/p/17900000000000001/`) em vez do permalink. Ela nao abre e nunca casa com metrica.
 * Marcar em vez de fingir que casa: quem chama trata como URL invalida.
 */
function postKey(urlOrId) {
  if (!urlOrId) return null;
  const u = String(urlOrId).trim();
  let m;

  m = u.match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  if (m) return (/^\d{15,}$/.test(m[1]) ? 'igmedia:' : 'ig:') + m[1];

  m = u.match(/urn:li:(?:share|activity|ugcPost):(\d+)/);
  if (m) { const ms = linkedInMs(m[1]); return ms ? `li:${ms}` : null; }
  m = u.match(/linkedin\.com\/posts\/[^/]*-(\d{15,})-/);
  if (m) { const ms = linkedInMs(m[1]); return ms ? `li:${ms}` : null; }

  m = u.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  if (m) return `tt:${m[1]}`;

  m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/))([A-Za-z0-9_-]{6,})/);
  if (m) return `yt:${m[1]}`;

  m = u.match(/(?:x\.com|twitter\.com)\/(?:i\/web|[^/]+)\/status\/(\d+)/);
  if (m) return `x:${m[1]}`;

  return null;
}

/** URL que nao vira chave (ou vira igmedia:) nao entra no registro. */
function isJoinable(urlOrId) {
  const k = postKey(urlOrId);
  return !!k && !k.startsWith('igmedia:');
}

/** Indice chave -> linha, a partir das medicoes. Primeira ocorrencia ganha. */
function indexByKey(rows, urlOf = (r) => r.post_url) {
  const map = new Map();
  for (const r of rows) {
    const k = postKey(urlOf(r));
    if (k && !map.has(k)) map.set(k, r);
  }
  return map;
}

/** Busca no indice. Igualdade pra todas as redes; LinkedIn cai na tolerancia de 5s. */
function lookup(index, key) {
  if (!key) return null;
  const exact = index.get(key);
  if (exact) return exact;
  if (!key.startsWith('li:')) return null;
  const ms = Number(key.slice(3));
  let best = null, bestD = Infinity;
  // ponytail: varredura linear no indice (dezenas de posts de LinkedIn). Se virar milhares, ordenar.
  for (const [k, v] of index) {
    if (!k.startsWith('li:')) continue;
    const d = Math.abs(Number(k.slice(3)) - ms);
    if (d <= LI_TOLERANCE_MS && d < bestD) { best = v; bestD = d; }
  }
  return best;
}

module.exports = { postKey, isJoinable, indexByKey, lookup, LI_TOLERANCE_MS };

if (require.main === module) {
  const assert = require('node:assert');

  assert.strictEqual(postKey('https://www.instagram.com/reel/AbcDefGhi12/'), 'ig:AbcDefGhi12');
  assert.strictEqual(postKey('https://www.instagram.com/p/AbcDefGhi12'), 'ig:AbcDefGhi12');
  assert.strictEqual(postKey('https://www.tiktok.com/@acme/video/7000000000000000003'), 'tt:7000000000000000003');
  assert.strictEqual(postKey('https://youtu.be/abcDEF12345'), 'yt:abcDEF12345');
  assert.strictEqual(postKey('https://x.com/acme/status/1234567890123456789'), 'x:1234567890123456789');
  assert.strictEqual(postKey('https://twitter.com/i/web/status/1234567890123456789'), 'x:1234567890123456789');
  assert.ok(isJoinable('https://x.com/acme/status/1234567890123456789'));
  assert.strictEqual(postKey('https://acme.example/blog/x'), null);
  assert.strictEqual(postKey(null), null);

  // Reel publicado por nos e o mesmo post medido pelo analyzer, mesmo com /reel/ x /p/.
  assert.strictEqual(postKey('https://www.instagram.com/reel/ABC12345678/'),
    postKey('https://www.instagram.com/p/ABC12345678/'));

  // URL montada com media id da Graph API: marcada, nunca casada como se fosse permalink.
  assert.strictEqual(postKey('https://www.instagram.com/p/17900000000000001/'), 'igmedia:17900000000000001');
  assert.ok(!isJoinable('https://www.instagram.com/p/17900000000000001/'));
  assert.ok(isJoinable('https://www.instagram.com/p/AbcDefGhi12/'));

  // PAR REAL (22/jul/2026): share do publisher x activity do analyzer, 340 ms de distancia.
  const share = 'https://www.linkedin.com/feed/update/urn:li:share:7000000060939640832';
  const activity = 'urn:li:activity:7000000062365753344';
  assert.notStrictEqual(postKey(share), postKey(activity), 'share e activity sao ids diferentes');
  const idx = indexByKey([{ post_url: activity, tag: 'medido' }]);
  assert.strictEqual(lookup(idx, postKey(share)).tag, 'medido', 'LinkedIn casa por proximidade de ms');

  // Longe demais no tempo: nao casa. Sem isso o LinkedIn casaria qualquer post com qualquer post.
  const outro = { post_url: 'urn:li:activity:6997493548774133760' };
  assert.strictEqual(lookup(indexByKey([outro]), postKey(share)), null);

  // Barra no fim nao muda a chave (o publisher grava dos dois jeitos).
  assert.strictEqual(postKey(share + '/'), postKey(share));

  console.log('post-key: OK');
}
