const TOKEN_FAILURE = /invalidated|validating access token|OAuthException/i;

function normalizeHandle(handle) {
  return String(handle || '').trim().replace(/^@/, '').toLowerCase();
}

function reconnectAlert(handle) {
  // Link direto pro app do Meta for Developers configurado via env (por conta ha um app
  // proprio, o painel varia por token). Sem env, cai no aviso generico.
  const appUrl = process.env[`META_APP_URL_${handle.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`];
  if (appUrl) return `IG @${handle} token caiu -> renova: ${appUrl} (Instagram > API setup)`;
  return `IG @${handle} token caiu -> renova no painel Meta`;
}

function accountStatus(accounts, handle) {
  if (!accounts.has(handle)) {
    accounts.set(handle, { failed: false, snapshotPosts: null, tokenFailure: false });
  }
  return accounts.get(handle);
}

function parseInstagramRun({ exitCode, output, requiredHandle }) {
  const required = normalizeHandle(requiredHandle);
  const accounts = new Map();
  const alerts = new Set();
  let currentHandle = null;

  for (const line of String(output || '').split(/\r?\n/)) {
    const header = line.match(/^\s*==\s+@([^\s=]+)\s+==\s*$/);
    if (header) {
      currentHandle = normalizeHandle(header[1]);
      accountStatus(accounts, currentHandle);
      continue;
    }

    const snapshot = line.match(/\bSnapshot:\s+(\d+)\s+posts\b/i);
    if (snapshot) {
      if (currentHandle) {
        const status = accountStatus(accounts, currentHandle);
        status.snapshotPosts = Number.parseInt(snapshot[1], 10);
      }
    }

    const failure = line.match(/Falha em @([^\s:]+):\s*(.*)$/i);
    if (failure) {
      const handle = normalizeHandle(failure[1]);
      const status = accountStatus(accounts, handle);
      status.failed = true;
      if (TOKEN_FAILURE.test(failure[2])) status.tokenFailure = true;
    }

    if (currentHandle && TOKEN_FAILURE.test(line)) {
      accountStatus(accounts, currentHandle).tokenFailure = true;
    }
  }

  for (const [handle, status] of accounts) {
    if (status.tokenFailure) alerts.add(reconnectAlert(handle));
  }

  const requiredStatus = required ? accountStatus(accounts, required) : null;
  const requiredPostCount = requiredStatus ? requiredStatus.snapshotPosts : null;
  const snapshots = [...accounts.values()].filter(
    (status) => status.snapshotPosts > 0 && !status.failed,
  ).length;
  const requiredHandleOk = Boolean(
    requiredStatus && requiredPostCount > 0 && !requiredStatus.failed && exitCode === 0
  );
  const failures = [];

  if (exitCode !== 0) failures.push(`Instagram analyzer saiu com exit ${exitCode}`);
  if (!required) failures.push('Instagram requiredHandle ausente');
  else if (!requiredHandleOk) failures.push(`IG @${required} nao produziu snapshot atualizado`);

  return {
    ok: failures.length === 0,
    snapshots,
    requiredPostCount,
    requiredHandleOk,
    alerts: [...alerts],
    failures,
  };
}

module.exports = { parseInstagramRun };
