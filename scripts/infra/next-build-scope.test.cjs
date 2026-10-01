const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const tsconfig = JSON.parse(fs.readFileSync(path.join(root, 'tsconfig.json'), 'utf8'));

assert.ok(
  Array.isArray(tsconfig.exclude) && tsconfig.exclude.includes('remotion'),
  'o build Next deve excluir o projeto Remotion independente',
);
assert.ok(
  tsconfig.exclude.includes('carousel-generator-ref'),
  'o build Next deve excluir o gerador de carrossel independente',
);

for (const directory of ['app', 'src', 'pages', 'components']) {
  const target = path.join(root, directory);
  if (!fs.existsSync(target)) continue;
  const files = fs.readdirSync(target, { recursive: true })
    .filter((file) => /\.(?:ts|tsx)$/.test(file));
  for (const file of files) {
    const body = fs.readFileSync(path.join(target, file), 'utf8');
    assert.doesNotMatch(body, /remotion\/src/);
  }
}

console.log('next-build-scope: ok');
