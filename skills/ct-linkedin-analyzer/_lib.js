// _lib.js — helpers comuns pra LinkedIn analyzer.
const https = require('https');
const fs = require('fs');
const path = require('path');

function httpsJson({ hostname, pathAndQuery, token, method = 'GET' }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        path: pathAndQuery,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'LinkedIn-Version': '202508',
          'X-Restli-Protocol-Version': '2.0.0',
          Accept: 'application/json',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            if (res.statusCode >= 400) {
              const err = new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed).slice(0, 400)}`);
              err.status = res.statusCode;
              err.body = parsed;
              return reject(err);
            }
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Parse ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function fetchPosts({ token, authorUrn, limit }) {
  const posts = [];
  let start = 0;
  const pageSize = Math.min(50, limit);
  while (posts.length < limit) {
    const encoded = encodeURIComponent(authorUrn);
    const q = `/rest/posts?author=${encoded}&q=author&count=${pageSize}&start=${start}`;
    let res;
    try {
      res = await httpsJson({ hostname: 'api.linkedin.com', pathAndQuery: q, token });
    } catch (e) {
      throw e;
    }
    const batch = res.elements || [];
    if (!batch.length) break;
    for (const p of batch) {
      posts.push(p);
      if (posts.length >= limit) break;
    }
    start += batch.length;
    if (batch.length < pageSize) break;
  }
  return posts.slice(0, limit);
}

async function fetchSocialActions({ token, postUrn }) {
  const encoded = encodeURIComponent(postUrn);
  const pathQ = `/rest/socialActions/${encoded}`;
  try {
    const res = await httpsJson({ hostname: 'api.linkedin.com', pathAndQuery: pathQ, token });
    return {
      likes: (res.likesSummary && res.likesSummary.totalLikes) || 0,
      comments: (res.commentsSummary && res.commentsSummary.aggregatedTotalComments) || 0,
    };
  } catch (e) {
    return { likes: 0, comments: 0, error: e.message };
  }
}

function normalize(post, actions) {
  const commentary = (post.commentary || '').replace(/\r\n/g, '\n');
  return {
    id: post.id,
    urn: post.id,
    author: post.author,
    created_at: post.createdAt ? new Date(post.createdAt).toISOString() : null,
    last_modified: post.lastModifiedAt ? new Date(post.lastModifiedAt).toISOString() : null,
    visibility: post.visibility,
    lifecycle_state: post.lifecycleState,
    commentary,
    text_length: commentary.length,
    media_category: post.content ? Object.keys(post.content)[0] : null,
    likes: actions.likes,
    comments: actions.comments,
    engagement_score: actions.likes + actions.comments * 2,
    permalink: post.id ? `https://www.linkedin.com/feed/update/${post.id}` : null,
  };
}

function saveJson(dir, filename, data) {
  fs.mkdirSync(dir, { recursive: true });
  const full = path.join(dir, filename);
  fs.writeFileSync(full, JSON.stringify(data, null, 2), 'utf8');
  return full;
}

function appendMarkdown(mdPath, section) {
  fs.mkdirSync(path.dirname(mdPath), { recursive: true });
  let prev = '';
  if (fs.existsSync(mdPath)) prev = fs.readFileSync(mdPath, 'utf8');
  fs.writeFileSync(mdPath, prev + section, 'utf8');
}

// Grava metricas no historico (best-time + cockpit). Nunca quebra o fluxo.
async function snapshotLinkedIn({ client_slug, account_handle, enriched }) {
  try {
    const { writeMetrics } = require('../_shared/metrics-writer.cjs');
    const posts = (enriched || []).map((p) => ({
      post_id: p.urn || p.id,
      post_url: p.permalink,
      post_type: p.media_category || 'post',
      published_at: p.created_at || null,
      likes: p.likes,
      comments: p.comments,
      metrics: { engagement_score: p.engagement_score, text_length: p.text_length, visibility: p.visibility },
    }));
    const r = await writeMetrics({
      client_slug, platform: 'linkedin', account_handle, source: 'ct-linkedin-analyzer', posts,
    });
    console.log(`Snapshot: ${r.posts} posts -> ct_metrics_snapshots`);
  } catch (e) {
    console.warn(`[metrics] snapshot ignorado: ${e.message}`);
  }
}

module.exports = { httpsJson, fetchPosts, fetchSocialActions, normalize, saveJson, appendMarkdown, snapshotLinkedIn };
