function latestPerPost(rows) {
  const latest = new Map();
  for (const row of rows) {
    const current = latest.get(row.post_id);
    if (!current || row.snapshot_date > current.snapshot_date) latest.set(row.post_id, row);
  }
  return [...latest.values()];
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function parseTimestamp(value) {
  if (value == null || value === '') return null;
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function filterPublishedSince(rows, now) {
  const end = parseTimestamp(now);
  if (end == null) return [];
  const start = end - THIRTY_DAYS_MS;
  return rows.filter((row) => {
    const publishedAt = parseTimestamp(row.published_at);
    return publishedAt != null && publishedAt >= start && publishedAt <= end;
  });
}

module.exports = { latestPerPost, filterPublishedSince };
