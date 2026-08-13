// Bundles the game into a single self-contained index.html (three.js inlined).
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || join(ROOT, 'dist', 'index.html');

const result = await build({
  entryPoints: [join(ROOT, 'src/main.js')],
  bundle: true,
  format: 'esm',
  minify: true,
  legalComments: 'none',
  target: ['es2020'],
  write: false,
  alias: { three: join(ROOT, 'vendor/three.module.min.js') },
});

const js = result.outputFiles[0].text;
const html = await readFile(join(ROOT, 'index.html'), 'utf8');

const out = html
  .replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '')
  .replace(
    /<script type="module" src="\.\/src\/main\.js"><\/script>/,
    () => '<script type="module">\n' + js + '\n</script>'
  );

if (out.includes('src/main.js')) throw new Error('entry script was not inlined');

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, out);
console.log(`built ${OUT} — ${(out.length / 1024).toFixed(0)} KB`);
