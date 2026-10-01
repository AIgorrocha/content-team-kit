const { execFile: nativeExecFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFile = promisify(nativeExecFile);
const DEFAULT_DURATION_TIMEOUT_MS = 15_000;
const MAX_DURATION_TIMEOUT_MS = 2_147_483_647;

function copyDurations(durationsById) {
  return durationsById && typeof durationsById === 'object' && !Array.isArray(durationsById)
    ? { ...durationsById }
    : {};
}

function resolveDurationTimeoutMs(value) {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value > 0
    && value <= MAX_DURATION_TIMEOUT_MS
    ? value
    : DEFAULT_DURATION_TIMEOUT_MS;
}

async function probeDuration(url, deps = {}) {
  if (typeof url !== 'string' || url.trim() === '') return null;

  const execute = typeof deps.execFile === 'function' ? deps.execFile : execFile;
  const timeout = resolveDurationTimeoutMs(deps.durationTimeoutMs);
  try {
    const result = await execute(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', url],
      { encoding: 'utf8', shell: false, timeout }
    );
    const stdout = typeof result === 'string' ? result : result && result.stdout;
    const parsed = JSON.parse(stdout);
    const rawDuration = parsed && parsed.format && parsed.format.duration;
    const duration = typeof rawDuration === 'number'
      ? rawDuration
      : typeof rawDuration === 'string' && rawDuration.trim() !== ''
        ? Number(rawDuration)
        : Number.NaN;

    return Number.isFinite(duration) && duration >= 0 ? duration : null;
  } catch {
    return null;
  }
}

async function enrichDurations(media, deps = {}) {
  const durationsById = copyDurations(deps.durationsById);
  if (!Array.isArray(media)) return durationsById;

  for (const item of media) {
    if (!item || typeof item.id !== 'string' || item.id === '') continue;
    if (Object.prototype.hasOwnProperty.call(durationsById, item.id)) continue;
    if (item.media_type !== 'VIDEO') continue;

    durationsById[item.id] = await probeDuration(item.media_url, deps);
  }

  return durationsById;
}

module.exports = {
  probeDuration,
  enrichDurations,
};
