import { build } from 'esbuild';
const isProd = process.env.NODE_ENV === 'production';

build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target: ['node18'],
  outfile: 'dist/server.js',
  sourcemap: !isProd,
  format: 'cjs',
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
}).then(() => {
  console.log('esbuild: build succeeded — dist/server.js');
}).catch((err) => {
  console.error('esbuild: build failed');
  console.error(err);
  process.exit(1);
});
