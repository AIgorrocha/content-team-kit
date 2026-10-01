#!/usr/bin/env node
// adapt.js — le ultimo JSON do ct-linkedin-analyzer e gera versao Twitter
// (single tweet ou thread numerada). Salva em output/republicar-twitter/.

const fs = require('fs');
const path = require('path');
const { CLIENT_ACCOUNTS } = require('../_shared/ig-accounts.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const LI_DIR = path.join(ROOT, 'output', 'linkedin-analyzer');
const OUT_DIR = path.join(ROOT, 'output', 'republicar-twitter');
const HISTORY_PATH = path.join(OUT_DIR, 'posted-history.json');

const TWEET_LIMIT = 270; // margem pra sufixo " N/T"
// Twitter e exclusivo da conta "principal" do cliente ativo (ver CLAUDE.md).
const PRINCIPAL_NAMES = [CLIENT_ACCOUNTS.principal?.linkedin?.displayName, CLIENT_ACCOUNTS.principal?.linkedin?.handle].filter(Boolean);

function findLatestLinkedInJson(handle = CLIENT_ACCOUNTS.principal?.linkedin?.handle) {
  if (!fs.existsSync(LI_DIR)) throw new Error(`Pasta nao encontrada: ${LI_DIR}`);
  const files = fs
    .readdirSync(LI_DIR)
    .filter((f) => f.startsWith(`${handle}-`) && f.endsWith('.json'))
    .sort()
    .reverse();
  if (!files.length) throw new Error(`Nenhum JSON de ${handle} em ${LI_DIR}`);
  return path.join(LI_DIR, files[0]);
}

function loadHistory() {
  if (!fs.existsSync(HISTORY_PATH)) return { posted_urns: [] };
  try {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  } catch {
    return { posted_urns: [] };
  }
}

function cleanText(text) {
  if (!text) return '';
  // Remove URLs LinkedIn (lnkd.in e linkedin.com)
  let t = text.replace(/https?:\/\/(www\.)?(lnkd\.in|linkedin\.com)\/\S+/gi, '');
  // Normaliza espacos (preserva quebras de linha duplas)
  t = t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return t;
}

// Quebra texto em chunks de ate maxLen, respeitando paragrafos/sentencas/palavras
function splitIntoChunks(text, maxLen) {
  if (text.length <= maxLen) return [text];

  const chunks = [];
  const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

  let buffer = '';
  const flush = () => {
    if (buffer.trim()) chunks.push(buffer.trim());
    buffer = '';
  };

  for (const para of paragraphs) {
    // Paragrafo cabe no buffer atual?
    if ((buffer + '\n\n' + para).trim().length <= maxLen) {
      buffer = buffer ? buffer + '\n\n' + para : para;
      continue;
    }

    flush();

    // Paragrafo sozinho cabe?
    if (para.length <= maxLen) {
      buffer = para;
      continue;
    }

    // Quebra por sentenca
    const sentences = para.split(/(?<=[.!?])\s+/);
    for (const s of sentences) {
      if (s.length > maxLen) {
        // Sentenca gigante: quebra por palavra
        const words = s.split(/\s+/);
        for (const w of words) {
          if ((buffer + ' ' + w).trim().length <= maxLen) {
            buffer = buffer ? buffer + ' ' + w : w;
          } else {
            flush();
            buffer = w;
          }
        }
      } else if ((buffer + ' ' + s).trim().length <= maxLen) {
        buffer = buffer ? buffer + ' ' + s : s;
      } else {
        flush();
        buffer = s;
      }
    }
  }
  flush();
  return chunks;
}

function adaptPost(post) {
  const cleaned = cleanText(post.text || '');
  if (!cleaned) return null;

  // Single tweet se couber
  if (cleaned.length <= TWEET_LIMIT + 10 && cleaned.length <= 280) {
    return [cleaned];
  }

  const chunks = splitIntoChunks(cleaned, TWEET_LIMIT);
  const total = chunks.length;
  if (total === 1) return chunks;

  // Adiciona numeracao N/T
  return chunks.map((c, i) => {
    const suffix = ` ${i + 1}/${total}`;
    // Garante que cabe
    const maxBase = 280 - suffix.length;
    const base = c.length > maxBase ? c.slice(0, maxBase - 1).trimEnd() + '…' : c;
    return base + suffix;
  });
}

function isPrincipalPost(post) {
  const name = (post.author_name || '').trim();
  return PRINCIPAL_NAMES.some((n) => name.toLowerCase().includes(n.toLowerCase()));
}

function parseThreadFile(raw) {
  const parts = String(raw)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) throw new Error('thread-twitter.txt vazio')
  return parts
}

function flag(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : null
}

function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const fromFile = flag('--from')
  const slug = flag('--slug')
  const threadPath = fromFile
    || (slug
      ? path.join(ROOT, 'content', CLIENT_ACCOUNTS.principal.clientSlug, 'reels', slug, 'thread-twitter.txt')
      : null)

  if (threadPath) {
    if (!fs.existsSync(threadPath)) throw new Error(`arquivo nao encontrado: ${threadPath}`)
    const thread = parseThreadFile(fs.readFileSync(threadPath, 'utf8'))
    const today = new Date().toISOString().slice(0, 10)
    const outPath = path.join(OUT_DIR, `adapted-${today}.json`)
    const item = {
      original_urn: `file:${path.relative(ROOT, threadPath).replace(/\\/g, '/')}`,
      original_text: thread.join('\n\n'),
      thread,
    }
    const output = {
      adapted_at: new Date().toISOString(),
      source_file: path.relative(ROOT, threadPath).replace(/\\/g, '/'),
      total_items: 1,
      stats: { single_tweet: thread.length === 1 ? 1 : 0, thread: thread.length > 1 ? 1 : 0 },
      items: [item],
    }
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8')
    console.log(`[adapt] fonte: ${threadPath}`)
    console.log(`[adapt] ${thread.length} tweet(s)`)
    console.log(`[adapt] Salvo em: ${outPath}`)
    thread.forEach((t, i) => console.log(`  [${i + 1}] (${t.length} chars) ${t.slice(0, 120)}`))
    return
  }

  const liPath = findLatestLinkedInJson();
  console.log(`[adapt] Lendo: ${liPath}`);
  const data = JSON.parse(fs.readFileSync(liPath, 'utf8'));
  const posts = Array.isArray(data.posts) ? data.posts : [];

  const history = loadHistory();
  const posted = new Set(history.posted_urns || []);

  const items = [];
  let skippedOther = 0;
  let skippedPosted = 0;
  let singleCount = 0;
  let threadCount = 0;

  for (const post of posts) {
    if (!isPrincipalPost(post)) {
      skippedOther++;
      continue;
    }
    if (post.urn && posted.has(post.urn)) {
      skippedPosted++;
      continue;
    }
    const thread = adaptPost(post);
    if (!thread || !thread.length) continue;

    if (thread.length === 1) singleCount++;
    else threadCount++;

    items.push({
      original_urn: post.urn || null,
      original_text: post.text || '',
      original_reactions: post.reactions || 0,
      original_comments: post.comments || 0,
      original_posted_label: post.posted_label || null,
      thread,
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const outPath = path.join(OUT_DIR, `adapted-${today}.json`);
  const output = {
    adapted_at: new Date().toISOString(),
    source_file: path.relative(ROOT, liPath).replace(/\\/g, '/'),
    total_items: items.length,
    stats: {
      single_tweet: singleCount,
      thread: threadCount,
      skipped_not_principal: skippedOther,
      skipped_already_posted: skippedPosted,
    },
    items,
  };
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`[adapt] ${items.length} post(s) adaptado(s)`);
  console.log(`  - single tweet: ${singleCount}`);
  console.log(`  - thread:       ${threadCount}`);
  console.log(`  - pulado (nao Principal): ${skippedOther}`);
  console.log(`  - pulado (ja publicado): ${skippedPosted}`);
  console.log(`[adapt] Salvo em: ${outPath}`);

  if (items.length) {
    console.log(`\n[amostra item 1]`);
    const first = items[0];
    console.log(`URN: ${first.original_urn}`);
    console.log(`Thread com ${first.thread.length} tweet(s):`);
    first.thread.forEach((t, i) => {
      console.log(`  [${i + 1}] (${t.length} chars) ${t.slice(0, 120)}${t.length > 120 ? '...' : ''}`);
    });
  }
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error('[adapt] ERRO:', e.message);
    process.exit(1);
  }
}

module.exports = { adaptPost, splitIntoChunks, cleanText, parseThreadFile };
