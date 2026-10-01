const fs = require('fs');
const path = require('path');
const swcBinaries = [
  '@next/swc-linux-x64-gnu/next-swc.linux-x64-gnu.node',
  '@next/swc-linux-x64-musl/next-swc.linux-x64-musl.node',
];
for (const binary of swcBinaries) {
  const fullPath = path.join(__dirname, '..', 'node_modules', binary);
  if (fs.existsSync(fullPath)) {
    fs.renameSync(fullPath, fullPath + '.bak');
    console.log('Disabled incompatible SWC binary:', binary);
  }
}
