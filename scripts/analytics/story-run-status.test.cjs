const assert = require('node:assert/strict');
const { storyExitCode } = require('./story-run-status.cjs');

{
  const report = [{ handle: 'acme', status: 'ok', stories: 0, sucesso: 0, falhas: 0 }];

  assert.equal(storyExitCode(report), 0);
}

{
  const report = [{ handle: 'acme', status: 'ok', stories: 2, sucesso: 2, falhas: 0 }];

  assert.equal(storyExitCode(report), 0);
}

{
  const report = [{ handle: 'acme', status: 'parcial', stories: 2, sucesso: 1, falhas: 1 }];

  assert.equal(storyExitCode(report), 1);
}

{
  const report = [{ handle: 'acme', status: 'erro', stories: 1, sucesso: 0, falhas: 1 }];

  assert.equal(storyExitCode(report), 1);
}

{
  const report = [{ handle: 'acme', status: 'ok', stories: 1, sucesso: 0, falhas: 1 }];

  assert.equal(storyExitCode(report), 1);
}

{
  const report = [{ handle: 'acme', status: 'sem-credencial' }];

  assert.equal(storyExitCode(report), 1);
}

console.log('story-run-status: OK');
