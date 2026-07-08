const { build } = require('esbuild');

build({
  entryPoints: ['src/app.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/app.js',
  external: [],
}).catch(() => process.exit(1));