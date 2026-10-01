#!/usr/bin/env node
// analyze-personal.js - analisa posts da conta pessoal (urn:li:person).
const path = require('path');
require('dotenv').config({ quiet: true, path: path.join(__dirname, '../../.env.local') });

const { fetchPosts, fetchSocialActions, normalize, saveJson, appendMarkdown, snapshotLinkedIn } = require('./_lib');
const { CLIENT_ACCOUNTS } = require('../_shared/ig-accounts.cjs');

const TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const PERSON_ID = process.env.LINKEDIN_PERSON_ID;

function parseArgs() {
  const args = { limit: 20 };
  const rest = process.argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--limit') args.limit = parseInt(rest[++i], 10);
  }
  return args;
}

async function run() {
  if (!TOKEN || !PERSON_ID) {
    console.error('Faltam LINKEDIN_ACCESS_TOKEN ou LINKEDIN_PERSON_ID no .env.local');
    process.exit(1);
  }
  const { limit } = parseArgs();
  const urn = `urn:li:person:${PERSON_ID}`;
  console.log(`Buscando ultimos ${limit} posts de ${urn}...`);

  let posts = [];
  try {
    posts = await fetchPosts({ token: TOKEN, authorUrn: urn, limit });
  } catch (e) {
    console.error(`Falha ao buscar posts: ${e.message}`);
    if (e.status === 401 || e.status === 403) {
      console.error('Token pode ter expirado ou faltar scope r_member_social.');
    }
    process.exit(2);
  }
  console.log(`${posts.length} posts obtidos. Buscando metricas...`);

  const enriched = [];
  for (const p of posts) {
    const actions = await fetchSocialActions({ token: TOKEN, postUrn: p.id });
    enriched.push(normalize(p, actions));
  }

  enriched.sort((a, b) => b.engagement_score - a.engagement_score);

  const today = new Date().toISOString().slice(0, 10);
  const jsonPath = saveJson(
    path.join(__dirname, '../../output/linkedin-analyzer'),
    `personal-${today}.json`,
    { scope: 'personal', person_id: PERSON_ID, fetched_at: new Date().toISOString(), posts: enriched }
  );
  console.log(`JSON: ${jsonPath}`);

  const lines = [];
  lines.push(`\n## LinkedIn Pessoal (${today})\n`);
  lines.push(`- Posts analisados: ${enriched.length}`);
  const totalLikes = enriched.reduce((s, p) => s + p.likes, 0);
  const totalComments = enriched.reduce((s, p) => s + p.comments, 0);
  lines.push(`- Total likes: ${totalLikes} | Total comments: ${totalComments}`);
  lines.push('');
  lines.push('### Top 5 por engajamento');
  enriched.slice(0, 5).forEach((p, i) => {
    const excerpt = (p.commentary || '').replace(/\n/g, ' ').slice(0, 140);
    lines.push(`${i + 1}. ${(p.created_at || '').slice(0, 10)} - ${p.likes} likes / ${p.comments} comments`);
    lines.push(`   "${excerpt}"`);
  });
  lines.push('');

  const mdPath = path.join(__dirname, '../../content/research', `${today}-linkedin-analysis.md`);
  appendMarkdown(mdPath, lines.join('\n'));
  console.log(`MD append: ${mdPath}`);

  await snapshotLinkedIn({ client_slug: CLIENT_ACCOUNTS.principal.clientSlug, account_handle: CLIENT_ACCOUNTS.principal.linkedin.handle, enriched });

  console.log('\nTop 5 console:');
  enriched.slice(0, 5).forEach((p, i) => {
    console.log(`${i + 1}. ${p.likes}L/${p.comments}C - ${(p.commentary || '').slice(0, 80)}...`);
  });
}

run().catch((e) => {
  console.error('Falha:', e.message);
  process.exit(1);
});
