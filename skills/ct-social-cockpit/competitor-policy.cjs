const TRACKING_HEADING = /^##\s+Tracking Instagram\b[^\r\n]*(?:\r?\n|$)/im;
const NEXT_SECTION = /^##\s+/im;
const TRACKING_ROW = /^\s*\|\s*\d+\s*\|\s*(?:\*{1,2})?@([A-Za-z0-9._]+)(?:\*{1,2})?\s*\|/;
const RAW_VIEW_FIELDS = ['play_count', 'video_view_count'];
const COMPETITOR_SNAPSHOT_KIND = 'competitor_snapshot_round';
const COMPETITOR_SNAPSHOT_STATE_VALID = 'valid';
const DEFAULT_COMPETITOR_SNAPSHOT_MAX_AGE_MS = 36 * 60 * 60 * 1000;

function parseTrackingHandles(markdown) {
  const source = String(markdown || '');
  const heading = TRACKING_HEADING.exec(source);
  if (!heading) return [];

  const afterHeading = source.slice(heading.index + heading[0].length);
  const nextSection = NEXT_SECTION.exec(afterHeading);
  const trackingSection = nextSection ? afterHeading.slice(0, nextSection.index) : afterHeading;
  const handles = new Set();

  for (const line of trackingSection.split(/\r?\n/)) {
    const match = TRACKING_ROW.exec(line);
    if (match) handles.add(match[1].toLowerCase());
  }

  return [...handles];
}

function publicViewCount(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return null;
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : null;
}

function extractPublicViews(node) {
  for (const field of RAW_VIEW_FIELDS) {
    const count = publicViewCount(node?.[field]);
    if (count != null) return count;
  }
  return null;
}

function extractPersistedPublicViews(post) {
  return publicViewCount(post?.public_views);
}

function rankByPublicViews(posts, extractViews) {
  if (!Array.isArray(posts)) return [];

  return posts
    .map((post, index) => {
      const withoutLegacyViralFlag = { ...(post || {}) };
      delete withoutLegacyViralFlag.is_viral;
      const publicViews = extractViews(post);
      const hasPublicViews = publicViews != null;
      return {
        index,
        post: {
          ...withoutLegacyViralFlag,
          public_views: publicViews,
          metric_state: hasPublicViews ? 'views_publicas' : 'sem_dado_disponivel',
        },
      };
    })
    .sort((left, right) => {
      const leftViews = left.post.public_views;
      const rightViews = right.post.public_views;
      if (leftViews == null && rightViews == null) return left.index - right.index;
      if (leftViews == null) return 1;
      if (rightViews == null) return -1;
      return rightViews - leftViews || left.index - right.index;
    })
    .map(({ post }) => post);
}

function rankCompetitorPosts(posts) {
  return rankByPublicViews(posts, extractPublicViews);
}

function rankPersistedCompetitorPosts(posts) {
  return rankByPublicViews(posts, extractPersistedPublicViews);
}

function normalizeHandle(handle) {
  return String(handle || '').trim().replace(/^@/, '').toLowerCase();
}

function sameHandleSet(left, right) {
  const a = [...new Set((left || []).map(normalizeHandle).filter(Boolean))].sort();
  const b = [...new Set((right || []).map(normalizeHandle).filter(Boolean))].sort();
  return a.length === b.length && a.every((handle, index) => handle === b[index]);
}

function validDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function expectedPostCounts(payload, expectedHandles) {
  const counts = payload?.expected_post_counts;
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)) {
    throw new Error('snapshot de concorrentes sem contagem esperada por perfil');
  }
  const entries = Object.entries(counts);
  if (entries.length !== expectedHandles.length) {
    throw new Error('snapshot de concorrentes sem contagem esperada para a watchlist ativa');
  }

  const normalized = {};
  for (const handle of expectedHandles) {
    const matches = entries.filter(([candidate]) => normalizeHandle(candidate) === handle);
    if (matches.length !== 1 || !Number.isSafeInteger(matches[0][1]) || matches[0][1] < 0) {
      throw new Error(`snapshot de concorrentes com contagem invalida para @${handle}`);
    }
    normalized[handle] = matches[0][1];
  }
  return normalized;
}

function expectedPostCountTotal(round) {
  const counts = Object.values(round?.expected_post_counts || {});
  if (!counts.length || counts.some((count) => !Number.isSafeInteger(count) || count < 0)) {
    throw new Error('snapshot de concorrentes sem contagem esperada valida');
  }
  return counts.reduce((total, count) => total + count, 0);
}

function currentRoundExternalIdFilter(round) {
  if (!round?.round_id || typeof round.round_id !== 'string') {
    throw new Error('snapshot de concorrentes sem round_id valido');
  }
  return `external_id=like.${encodeURIComponent(`snap:${round.round_id}:*`)}`;
}

function currentSnapshotRound({ roundRows, competitors, allowedHandles, now = new Date(), maxAgeMs = DEFAULT_COMPETITOR_SNAPSHOT_MAX_AGE_MS }) {
  const expectedHandles = [...new Set((allowedHandles || []).map(normalizeHandle).filter(Boolean))];
  if (!expectedHandles.length) throw new Error('watchlist ativa de concorrentes indisponivel');

  const payload = Array.isArray(roundRows) && roundRows.length ? roundRows[0]?.payload : null;
  if (!payload || payload.state !== COMPETITOR_SNAPSHOT_STATE_VALID) {
    throw new Error('snapshot de concorrentes nao esta valido para o round atual');
  }
  if (!payload.round_id || !sameHandleSet(payload.expected_handles, expectedHandles)) {
    throw new Error('snapshot de concorrentes nao corresponde a watchlist ativa');
  }
  const expectedPostCountsByHandle = expectedPostCounts(payload, expectedHandles);

  const startedAt = validDate(payload.started_at);
  const completedAt = validDate(payload.completed_at);
  const referenceNow = validDate(now);
  const maxAge = Number(maxAgeMs);
  if (!startedAt || !completedAt || !referenceNow || !Number.isFinite(maxAge) || maxAge < 0) {
    throw new Error('snapshot de concorrentes sem timestamp confiavel');
  }
  const age = referenceNow.getTime() - completedAt.getTime();
  if (completedAt < startedAt || age < 0 || age > maxAge) {
    throw new Error('snapshot de concorrentes desatualizado');
  }

  const selected = [];
  for (const handle of expectedHandles) {
    const matches = (competitors || []).filter((competitor) => normalizeHandle(competitor?.handle) === handle);
    if (matches.length !== 1) throw new Error(`snapshot de concorrentes sem perfil unico para @${handle}`);
    selected.push(matches[0]);
  }

  return {
    round_id: payload.round_id,
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
    expected_handles: expectedHandles,
    expected_post_counts: expectedPostCountsByHandle,
    competitors: selected,
  };
}

function isCurrentRoundPost(post, round) {
  if (!post || !round || post?.engagement?.snapshot_round !== round.round_id) return false;
  if (typeof post.external_id !== 'string' || !post.external_id.startsWith(`snap:${round.round_id}:`)) return false;
  const scrapedAt = validDate(post.scraped_at);
  const startedAt = validDate(round.started_at);
  const completedAt = validDate(round.completed_at);
  return Boolean(scrapedAt && startedAt && completedAt && scrapedAt >= startedAt && scrapedAt <= completedAt);
}

function currentRoundPosts(posts, round) {
  if (!Array.isArray(posts)) throw new Error('snapshot de concorrentes com posts em formato invalido');
  const competitorsById = Object.fromEntries((round?.competitors || []).map((competitor) => [competitor.id, competitor]));
  const counts = Object.fromEntries((round?.expected_handles || []).map((handle) => [handle, 0]));
  const externalIds = new Set();

  for (const post of posts) {
    const competitor = competitorsById[post?.competitor_id];
    if (!competitor) throw new Error('snapshot de concorrentes retornou perfil fora da watchlist ativa');
    if (post?.engagement?.snapshot_round !== round?.round_id) {
      throw new Error('snapshot de concorrentes retornou post fora do round atual');
    }
    if (!isCurrentRoundPost(post, round)) {
      throw new Error('snapshot de concorrentes com scraped_at invalido para o round atual');
    }
    if (externalIds.has(post.external_id)) {
      throw new Error('snapshot de concorrentes com post duplicado no round atual');
    }
    externalIds.add(post.external_id);
    counts[normalizeHandle(competitor.handle)] += 1;
  }

  for (const handle of round?.expected_handles || []) {
    const expected = round.expected_post_counts?.[handle];
    const actual = counts[handle];
    if (actual !== expected) {
      throw new Error(`snapshot de concorrentes com contagem incompleta para @${handle}: esperada ${expected}, recebida ${actual}`);
    }
  }
  return posts;
}

function dailySnapshotRoundId(client, now = new Date()) {
  const date = validDate(now);
  if (!date) throw new Error('clock do snapshot de concorrentes invalido');
  return `${client}:${date.toISOString().slice(0, 10)}`;
}

module.exports = {
  COMPETITOR_SNAPSHOT_KIND,
  COMPETITOR_SNAPSHOT_STATE_VALID,
  DEFAULT_COMPETITOR_SNAPSHOT_MAX_AGE_MS,
  parseTrackingHandles,
  extractPublicViews,
  extractPersistedPublicViews,
  rankCompetitorPosts,
  rankPersistedCompetitorPosts,
  currentSnapshotRound,
  currentRoundPosts,
  isCurrentRoundPost,
  expectedPostCountTotal,
  currentRoundExternalIdFilter,
  dailySnapshotRoundId,
};
