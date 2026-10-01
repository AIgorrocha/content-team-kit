#!/usr/bin/env node
/**
 * verify-daily-stories.mjs - PASSE EDITORIAL DIARIO dos Stories da conta do cliente.
 *
 * POR QUE ESTE SCRIPT EXISTE (leia antes de mexer):
 * O cliente posta MUITO story manual (varias contas ativas) e quase nunca registra
 * no Content Team. Sem verificar, os agentes ficam cegos pro que ele realmente publica
 * e nao aprendem o estilo/ritmo dele. Este job roda 1x por dia, de noite, pega os
 * stories que foram ao ar no dia (ainda no ar, expiram em 24h), CLASSIFICA cada um
 * (tipo/tema/formato + texto lido do frame) e monta a LINHA DO TEMPO acumulada.
 *
 * NAO CONFUNDIR com collect-story-insights.mjs (cron de 4/4h):
 *   - collect-story-insights = passe de METRICA. Grava reach/views/replies por story
 *     (post_id = id cru da story, post_type='story'). Roda toda 4h pra pegar o insight
 *     perto do vencimento.
 *   - verify-daily-stories (este) = passe EDITORIAL. Grava o SIGNIFICADO de cada story
 *     (tipo, tema, formato, overlay lido) numa linha SEPARADA
 *     (post_id = `__storyverify__:{id}`, post_type='story_editorial'), 1x/dia.
 *   Os dois convivem sem colidir: post_id diferente => linha diferente no upsert por
 *   (platform, post_id, snapshot_date). Este aqui ANEXA o engajamento (reach/views/
 *   replies) na propria linha editorial, denormalizado de proposito, pra que o passe
 *   semanal de melhoria consiga cruzar FORMATO x ENGAJAMENTO lendo UMA tabela so.
 *
 * O QUE ALIMENTA (loop de auto-aprendizado, escopo ampliado 28/jul/2026):
 * A saida e ESTRUTURADA (account, tipo, tema, formato, gancho, overlay, engajamento)
 * justamente pra um passe SEMANAL separado (verify-weekly-improvement, a construir)
 * ler esse acervo e PROPOR melhorias: prompts dos ct-*, brand-profile/design-system,
 * viral-playbook (dado real da conta vira selo [MEDIDO]), e temas que o cliente deve
 * falar mais. Este cron diario NAO propoe nada alem de 1 linha de leitura marcada
 * [HIPOTESE] no digest; a proposta pesada fica no passe semanal.
 *
 * HONESTIDADE (regra dura do projeto):
 *   - Token expirado (OAuthException code=190) => loga, avisa no Telegram que precisa
 *     renovar, cai pro fallback (video da tela que o cliente manda). Nao inventa dado.
 *   - Numero so entra no digest se for MEDIDO pela API. Leitura minha = [HIPOTESE].
 *   - OCR do frame e best-effort: se tesseract nao estiver instalado, overlay fica null
 *     e o script avisa; classificacao cai pra caption + media_type. Nunca chuta texto.
 *   - Enquete/caixinha: a Graph API /me/stories NAO expoe sticker. has_poll fica
 *     'desconhecido' (nao da pra saber pela API); so um OCR que leia "SIM/NAO" arrisca.
 *
 * ENVIO NO TELEGRAM: o default do script (sem flags) e silencioso (digest so no log e no
 * Supabase). Quem quer a revisao diaria no Telegram (dentro da janela de 24h) passa
 * `--always` no agendamento. Pra silenciar de novo, e so tirar a flag, sem mexer no script.
 * Nessa mesma leva: o digest ganhou uma secao de POSTS normais (feed/reel/carrossel)
 * das ultimas 48h, lida direto do ct_metrics_snapshots que o cron CT_IG_DAILY (ig-daily-
 * snapshot.mjs, ~4h30 BRT) ja grava. Ou seja, a leitura de posts pode ter ate ~17h de
 * atraso em relacao ao horario deste cron (21h BRT) pro post mais recente do dia - o
 * numero e sempre [MEDIDO], so pode estar defasado. Se isso incomodar, aumentar a
 * frequencia do CT_IG_DAILY e a correcao (nao mexer aqui).
 *
 * Uso:
 *   node scripts/analytics/verify-daily-stories.mjs --dry-run   # nao grava, nao manda TG
 *   node scripts/analytics/verify-daily-stories.mjs --test-tg    # manda TG marcado [TESTE]
 *   node scripts/analytics/verify-daily-stories.mjs --always     # manda digest TODO DIA, mesmo sem novidade
 *   node scripts/analytics/verify-daily-stories.mjs --account principal
 *   node scripts/analytics/verify-daily-stories.mjs              # producao (cron)
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { writeMetrics } = require(path.join(REPO, 'skills', '_shared', 'metrics-writer.cjs'));
const { isIgDirectToken, CLIENT_ACCOUNTS } = require(path.join(REPO, 'skills', '_shared', 'ig-accounts.cjs'));

const apiBase = (t) => (isIgDirectToken(t) ? 'https://graph.instagram.com' : 'https://graph.facebook.com/v21.0');
const accountNode = (acc) => (isIgDirectToken(acc.token) ? 'me' : acc.userId);

const STORY_INSIGHT_METRICS = ['reach', 'views', 'impressions', 'replies', 'total_interactions', 'navigation'];

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(REPO, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const ACCOUNTS = () => Object.entries(CLIENT_ACCOUNTS).map(([key, acc]) => {
  const creds = acc.creds();
  return {
    key, client_slug: acc.clientSlug, handle: acc.handle, label: acc.clientSlug,
    token: creds.token, userId: creds.userId,
  };
});

// ---- Timezone: tudo que o cliente le e BRT (America/Sao_Paulo) ----
const fmtBRT = (iso) => {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(iso));
  } catch { return iso; }
};
const dateBRT = (iso) => {
  const d = new Date(iso || Date.now());
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d); // YYYY-MM-DD
};
const hourBRT = (iso) => {
  try {
    return parseInt(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date(iso)), 10);
  } catch { return null; }
};

async function get(url) {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = new Error(json?.error?.message || `HTTP ${res.status}`);
    e.code = json?.error?.code;
    e.subcode = json?.error?.error_subcode;
    throw e;
  }
  return json;
}

async function listActiveStories(acc) {
  const fields = 'id,media_type,media_url,permalink,timestamp,caption';
  const url = `${apiBase(acc.token)}/${accountNode(acc)}/stories?fields=${fields}&access_token=${encodeURIComponent(acc.token)}`;
  return (await get(url)).data || [];
}

/** Insight leve por story, so pra denormalizar engajamento na linha editorial e no digest.
 *  Degrada o catalogo igual ao collect-story-insights (a API recusa a chamada inteira
 *  se UMA metrica for invalida). Falha aqui NAO derruba a classificacao. */
async function fetchInsight(acc, storyId) {
  let current = [...STORY_INSIGHT_METRICS];
  for (let i = 0; i < STORY_INSIGHT_METRICS.length; i++) {
    if (!current.length) return {};
    try {
      const url = `${apiBase(acc.token)}/${storyId}/insights?metric=${current.join(',')}&access_token=${encodeURIComponent(acc.token)}`;
      const json = await get(url);
      const data = {};
      for (const m of json.data || []) {
        const v = m.total_value?.value ?? m.values?.[0]?.value;
        if (v !== undefined) data[m.name] = v;
        const bd = m.total_value?.breakdowns?.[0]?.results;
        if (Array.isArray(bd)) for (const r of bd) {
          const label = r.dimension_values?.[0];
          if (label) data[`navigation_${label}`] = r.value;
        }
      }
      return data;
    } catch (e) {
      const culprit = current.find((m) => (e.message || '').includes(m));
      if (!culprit) return {}; // erro de token/permissao: engajamento fica vazio, sem quebrar
      current = current.filter((m) => m !== culprit);
    }
  }
  return {};
}

// ---- Classificacao editorial (heuristica documentada) ----
// Precedencia: discussao > bastidor > insight > rotina. Sem sinal => 'indefinido'.
const RULES = [
  { tipo: 'discussao', re: /\?|enquete|caixinha|vota|vc acha|voce acha|concorda|responde|qual (voce|vc)|poll|pergunta/i },
  { tipo: 'bastidor',  re: /bastidor|making|por tras|nos bastidores|processo|render|trabalhando|setup|gravando|edicao|editando/i },
  { tipo: 'insight',   re: /dica|aprendi|licao|erro que|como (eu|voce|fazer)|porque|por que|agente|fluxo|automa|prompt|ferramenta|metodo|estrategia|aprenda/i },
  { tipo: 'rotina',    re: /bom dia|manha|cafe|rotina|agora|hoje|dia a dia|fim de semana|almoco|treino/i },
];
function classify(text) {
  const t = (text || '').toLowerCase();
  for (const r of RULES) if (r.re.test(t)) return r.tipo;
  return t.trim() ? 'indefinido' : 'sem-texto';
}
// tema curto: primeira frase util do texto (caption ou overlay), ate ~60 chars.
function tema(text) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  const frag = clean.split(/[.!?\n]/)[0].trim();
  return (frag || clean).slice(0, 60);
}
// gancho: os primeiros ~40 chars do overlay (o que aparece na tela = o gancho visual).
function gancho(overlay) {
  const clean = (overlay || '').replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, 40) : null;
}

// ---- Download + frame + OCR (best-effort) ----
let TESSERACT = null; // null=nao checado, ''=ausente, path=presente
function hasTesseract() {
  if (TESSERACT !== null) return !!TESSERACT;
  try { TESSERACT = execFileSync('which', ['tesseract']).toString().trim(); }
  catch { TESSERACT = ''; }
  return !!TESSERACT;
}
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'story-verify-'));

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return dest;
}
function extractFrame(video, out) {
  // 1 frame ~1s dentro do video (evita frame preto de abertura).
  execFileSync('ffmpeg', ['-y', '-ss', '1', '-i', video, '-frames:v', '1', '-q:v', '3', out],
    { stdio: 'ignore' });
  return out;
}
// OCR de frame de render/foto vira lixo (letras soltas, sem vogal). So confiamos no
// overlay quando ele PARECE texto real: >=2 palavras de 3+ letras COM vogal. Senao,
// devolvemos ok=false e a classificacao/tema caem pra caption (nunca chuta texto).
function sanitizeOcr(raw) {
  const clean = (raw || '').replace(/\s+/g, ' ').trim();
  if (!clean) return { text: null, confident: false };
  const palavras = clean.split(' ').filter((w) => /^[a-zA-ZÀ-ÿ]{3,}$/.test(w) && /[aeiouáéíóúâêôãõà]/i.test(w));
  if (palavras.length < 2) return { text: null, confident: false };
  // reconstroi so com as palavras plausiveis (tira ruido tipo "VR", "q", "3|")
  return { text: palavras.join(' ').slice(0, 200), confident: true };
}
function ocr(imgPath) {
  if (!hasTesseract()) return { text: null, ok: false, reason: 'tesseract ausente' };
  try {
    const out = execFileSync('tesseract', [imgPath, 'stdout', '-l', 'por+eng', '--psm', '11'],
      { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    const s = sanitizeOcr(out);
    return { text: s.text, ok: s.confident, reason: s.confident ? undefined : 'overlay sem texto legivel (render/foto)' };
  } catch (e) {
    return { text: null, ok: false, reason: e.message.slice(0, 80) };
  }
}
/** Le o overlay de um story: baixa midia, tira frame se video, roda OCR. Nunca joga erro. */
async function readOverlay(story) {
  if (!story.media_url) return { text: null, ok: false, reason: 'sem media_url' };
  try {
    const base = path.join(TMP, story.id.replace(/[^\w]/g, '_'));
    if (story.media_type === 'VIDEO') {
      const vid = await download(story.media_url, base + '.mp4');
      const frame = extractFrame(vid, base + '.jpg');
      return ocr(frame);
    }
    const img = await download(story.media_url, base + '.jpg');
    return ocr(img);
  } catch (e) {
    return { text: null, ok: false, reason: e.message.slice(0, 80) };
  }
}

// ---- Estado: quais stories ja foram classificados (diff por id via Supabase) ----
async function loadKnownIds() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Set();
  try {
    const endpoint = `${url}/rest/v1/ct_metrics_snapshots?select=post_id&post_id=like.__storyverify__:*`;
    const res = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) return new Set();
    const rows = await res.json();
    return new Set(rows.map((r) => r.post_id));
  } catch { return new Set(); }
}

// ---- Posts normais (feed/reel/carrossel) das ultimas 48h, lidos do que o CT_IG_DAILY
// ja coletou (ig-daily-snapshot.mjs, via ct-instagram-analyzer). Nao faz chamada nova
// a Graph API: so LE ct_metrics_snapshots, pra nao duplicar coleta nem gastar rate limit.
async function fetchRecentPosts(clientSlug, hours = 48) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  try {
    const params = new URLSearchParams({
      client_slug: `eq.${clientSlug}`,
      platform: 'eq.instagram',
      grain: 'eq.post',
      'post_type': 'not.in.(story,story_editorial)',
      published_at: `gte.${since}`,
      order: 'published_at.desc',
      select: 'post_id,post_url,post_type,published_at,likes,comments,reach,views,saves',
    });
    const res = await fetch(`${url}/rest/v1/ct_metrics_snapshots?${params}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

function buildPostsBlock(posts) {
  if (!posts.length) return '   posts (48h): nenhum publicado (ou ainda nao coletado)';
  const lines = posts.map((p) => {
    const eng = [
      p.likes != null ? `curtidas ${p.likes}` : null,
      p.comments != null ? `coment ${p.comments}` : null,
      (p.reach ?? p.views) != null ? `alcance ${p.reach ?? p.views}` : null,
    ].filter(Boolean).join(' · ') || 'sem metrica ainda';
    return `   • ${fmtBRT(p.published_at)} [${p.post_type}] ${eng}`;
  });
  return `   posts (48h) [MEDIDO na ultima coleta CT_IG_DAILY, ~4h30 BRT]:\n` + lines.join('\n');
}

// ---- Telegram ----
async function sendTelegram(text, { test = false } = {}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken) { console.warn('[tg] sem TELEGRAM_BOT_TOKEN - digest so no log'); return false; }
  const body = (test ? '[TESTE verify-daily-stories]\n' : '') + text;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: body, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const j = await res.json();
    if (!j.ok) throw new Error(j.description);
    return true;
  } catch (e) { console.error('[tg] falhou:', e.message); return false; }
}

// ---- Digest ----
function insightLine(perAccount) {
  // Leitura editorial = SEMPRE [HIPOTESE] (nao e metrica). Nunca inventa numero.
  const all = perAccount.flatMap((a) => a.novos);
  if (!all.length) return null;
  const withRepl = all.filter((s) => s.eng.replies != null && s.eng.reach);
  if (withRepl.length >= 2) {
    const best = withRepl.slice().sort((a, b) => (b.eng.replies / b.eng.reach) - (a.eng.replies / a.eng.reach))[0];
    return `💡 <i>[HIPOTESE]</i> O story de tipo <b>${best.tipo}</b> ("${best.tema || 's/tema'}") puxou a maior taxa de resposta hoje. Vale repetir esse formato e testar sequencia de 3.`;
  }
  const tipos = [...new Set(all.map((s) => s.tipo))];
  return `💡 <i>[HIPOTESE]</i> Hoje predominou ${tipos.join(', ')}. Sem insight de engajamento suficiente ainda (a coleta de 4/4h consolida perto do vencimento).`;
}

function buildDigest(perAccount, date) {
  const lines = [`📖 <b>Resumo do dia</b> (${date} BRT) - Stories + posts`];
  for (const a of perAccount) {
    if (a.error) { lines.push(`• <b>${a.label}</b>: ERRO ${a.error}`); continue; }
    if (!a.novos.length) { lines.push(`• <b>${a.label}</b>: sem story novo`); }
    else {
      const porTipo = {};
      for (const s of a.novos) porTipo[s.tipo] = (porTipo[s.tipo] || 0) + 1;
      const arco = Object.entries(porTipo).map(([t, n]) => `${t}(${n})`).join(', ');
      const temas = [...new Set(a.novos.map((s) => s.tema).filter(Boolean))].slice(0, 3).join(' · ');
      const horas = a.novos.map((s) => s.horaBRT).filter((h) => h != null).sort((x, y) => x - y);
      const janela = horas.length ? `${horas[0]}h-${horas[horas.length - 1]}h` : '';
      lines.push(`• <b>${a.label}</b>: ${a.novos.length} story(s) - arco: ${arco}${janela ? ` · ${janela}` : ''}${temas ? `\n   temas: ${temas}` : ''}`);
      // engajamento so quando MEDIDO
      const medidos = a.novos.filter((s) => s.eng.reach != null);
      if (medidos.length) {
        const reach = medidos.reduce((s, x) => s + (x.eng.reach || 0), 0);
        const repl = medidos.reduce((s, x) => s + (x.eng.replies || 0), 0);
        lines.push(`   engaj [MEDIDO]: alcance ${reach} · respostas ${repl}`);
      }
    }
    lines.push(buildPostsBlock(a.posts || []));
  }
  const ins = insightLine(perAccount);
  if (ins) lines.push('', ins);
  lines.push('', '<i>Stories: passe editorial diario (metrica fina no cron de 4/4h). Posts: ultima coleta CT_IG_DAILY. Proposta de melhoria = passe semanal.</i>');
  return lines.join('\n');
}

async function run() {
  loadEnv();
  const args = process.argv.slice(2);
  const only = args.includes('--account') ? args[args.indexOf('--account') + 1] : null;
  const dryRun = args.includes('--dry-run');
  const testTg = args.includes('--test-tg');
  const always = args.includes('--always');

  const stamp = new Date().toISOString();
  const today = dateBRT(stamp);
  console.log(`\n=== verify-daily-stories @ ${stamp} (BRT ${today}) ===`);
  if (dryRun) console.log('(dry-run: nao grava, nao manda TG real)');
  if (!hasTesseract()) console.log('AVISO: tesseract ausente -> OCR de overlay desativado, classificacao usa caption + media_type');

  const known = await loadKnownIds();
  console.log(`stories ja classificados no historico: ${known.size}`);

  const perAccount = [];
  let tokenErro = null;

  for (const acc of ACCOUNTS()) {
    if (only && acc.key !== only) continue;
    const precisaUserId = !isIgDirectToken(acc.token);
    if (!acc.token || (precisaUserId && !acc.userId)) {
      perAccount.push({ label: acc.label, novos: [], error: 'sem credencial' });
      continue;
    }

    let stories;
    try {
      stories = await listActiveStories(acc);
    } catch (e) {
      console.error(`ERRO ${acc.handle}: ${e.message} (code=${e.code})`);
      if (e.code === 190) tokenErro = `${acc.label}: token expirado (code 190) - renovar`;
      perAccount.push({ label: acc.label, novos: [], error: `${e.message} (code=${e.code})` });
      continue;
    }

    const novosStories = stories.filter((s) => !known.has(`__storyverify__:${s.id}`));
    console.log(`${acc.handle}: ${stories.length} ativas, ${novosStories.length} novas`);

    const novos = [];
    for (const s of novosStories) {
      const overlay = await readOverlay(s);
      const eng = await fetchInsight(acc, s.id);
      const text = [s.caption, overlay.text].filter(Boolean).join(' ');
      const tipo = classify(text);
      const engObj = {
        reach: eng.reach ?? null,
        views: eng.views ?? eng.impressions ?? null,
        replies: eng.replies ?? null,
        total_interactions: eng.total_interactions ?? null,
      };
      const rec = {
        story_id: s.id,
        media_type: s.media_type,
        timestamp: s.timestamp,
        timestamp_brt: fmtBRT(s.timestamp),
        horaBRT: hourBRT(s.timestamp),
        permalink: s.permalink || null,
        tipo,
        tema: tema(text),
        gancho: gancho(overlay.text),
        overlay_text: overlay.text,
        overlay_ok: overlay.ok,
        has_poll: 'desconhecido', // API /me/stories nao expoe sticker de enquete
        eng: engObj,
      };
      novos.push(rec);
      console.log(`  ${acc.handle} ${s.id} [${s.media_type}] tipo=${tipo} tema="${rec.tema || '-'}" overlay=${overlay.ok ? 'lido' : overlay.reason} reach=${engObj.reach ?? '-'} repl=${engObj.replies ?? '-'}`);

      // Persistencia: linha EDITORIAL estruturada, uma por story. snapshot_date = dia BRT
      // do story (nao "hoje"), pra o passe semanal filtrar por dia real de publicacao.
      if (!dryRun) {
        const snap = dateBRT(s.timestamp);
        await writeMetrics({
          client_slug: acc.client_slug,
          platform: 'instagram',
          account_handle: acc.handle,
          source: 'verify-daily-stories',
          snapshot_date: snap,
          posts: [{
            post_id: `__storyverify__:${s.id}`,
            post_url: s.permalink || null,
            post_type: 'story_editorial',
            published_at: s.timestamp || null,
            reach: engObj.reach,
            views: engObj.views,
            comments: engObj.replies,   // reply de story = "comentario" do formato
            impressions: null, likes: null, shares: null, saves: null,
            metrics: {
              account: acc.client_slug,
              formato: 'story',
              tipo, tema: rec.tema, gancho: rec.gancho,
              overlay_text: overlay.text, overlay_ok: overlay.ok,
              has_poll: rec.has_poll,
              media_type: s.media_type,
              timestamp_brt: rec.timestamp_brt,
              hora_brt: rec.horaBRT,
              engajamento: engObj,
              classified_by: overlay.ok ? 'overlay+caption' : 'caption+media_type',
              collected_at: stamp,
              // Campos prontos pro passe semanal de melhoria (verify-weekly-improvement)
              _para_analise: 'formato x tipo x tema x hora x engajamento; dado real vira [MEDIDO] no viral-playbook',
            },
          }],
        });
      }
    }

    const posts = await fetchRecentPosts(acc.client_slug);
    perAccount.push({ label: acc.label, novos, posts });
  }

  const totalNovos = perAccount.reduce((s, a) => s + a.novos.length, 0);
  const houveErro = perAccount.some((a) => a.error);
  console.log(`\ntotal novos hoje: ${totalNovos} | erros: ${houveErro}`);

  const digest = buildDigest(perAccount, today);
  console.log('\n--- DIGEST ---\n' + digest.replace(/<[^>]+>/g, ''));

  // Digest diario e INTERNO por padrao: fica no log e no Supabase, e
  // alimenta o loop de auto-aprendizado. Pra reativar pontualmente: DIGEST_TELEGRAM=1
  // no ambiente, ou a flag --test-tg/--always.
  const digestTgLigado = process.env.DIGEST_TELEGRAM === '1' || testTg || always;

  // Aviso de token IG expirado fica num job proprio (1x/dia). Daqui, so log.
  if (tokenErro) {
    console.log('token IG com problema (Telegram via ig-tokens.py):', tokenErro);
  }

  // --always bypassa a exigencia de novidade de proposito: e o que o cron de producao
  // usa pra mandar o resumo diario de posts+stories TODO DIA, mesmo em dia parado.
  const temNovidade = always || totalNovos > 0 || houveErro || tokenErro;
  if (digestTgLigado && temNovidade && (!dryRun || testTg)) {
    const ok = await sendTelegram(digest, { test: testTg });
    console.log(`telegram: ${ok ? 'enviado' : 'falhou'}`);
  } else {
    console.log('telegram: digest interno (nao enviado). DIGEST_TELEGRAM=1 pra reativar.');
  }

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
  process.exit(houveErro ? 1 : 0);
}

run().catch((e) => { console.error('FATAL:', e); process.exit(1); });
