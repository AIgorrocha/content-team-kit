const assert = require('node:assert/strict');
const { parseStoryAccountScope } = require('./story-account-scope.cjs');

assert.equal(parseStoryAccountScope([]), 'principal');
assert.equal(parseStoryAccountScope(['--dry-run']), 'principal');
assert.equal(parseStoryAccountScope(['--account', 'principal']), 'principal');
assert.equal(parseStoryAccountScope(['--account', 'business']), 'business');
assert.equal(parseStoryAccountScope(['--account', 'all']), 'all');

assert.throws(
  () => parseStoryAccountScope(['--account']),
  /--account exige principal, business ou all/,
);
assert.throws(
  () => parseStoryAccountScope(['--account', 'desconhecido']),
  /--account exige principal, business ou all/,
);

console.log('story-account-scope: ok');
