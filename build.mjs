import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  outfile: 'bundle.js',
  minify: false,
  legalComments: 'none',
  logLevel: 'info',
});
