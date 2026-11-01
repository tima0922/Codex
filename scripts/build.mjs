import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
await mkdir('public', { recursive: true });
const bundle = await build({ entryPoints: ['app/main.tsx'], bundle: true, minify: true, splitting: true, format: 'esm', outdir: 'public', entryNames: 'app-[hash]', chunkNames: 'chunks/[name]-[hash]', metafile: true, target: 'es2022', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' } });
await Promise.all(['index.html', 'style.css', 'neon.css'].map(f => copyFile(`app/${f}`, `public/${f}`)));
const entry = Object.entries(bundle.metafile.outputs).find(([,info]) => info.entryPoint === 'app/main.tsx')?.[0];
if (!entry) throw new Error('Missing client entry');
let html = await readFile('app/index.html', 'utf8');
html = html.replace('/app.js?v=neon2', '/' + entry.replace(/^public\//, ''));
for (const name of ['style', 'neon']) {
 const hash = createHash('sha256').update(await readFile(`app/${name}.css`)).digest('hex').slice(0,12);
 html = html.replace(`/${name}.css?v=neon2`, `/${name}.css?v=${hash}`);
}
await writeFile('public/index.html',html);
await mkdir('public/fonts', {recursive:true});
for (const family of ['manrope', 'unbounded']) {
 for (const subset of ['latin', 'cyrillic']) await copyFile(`node_modules/@fontsource-variable/${family}/files/${family}-${subset}-wght-normal.woff2`, `public/fonts/${family}-${subset}.woff2`);
 await copyFile(`node_modules/@fontsource-variable/${family}/LICENSE`, `public/fonts/${family}-LICENSE.txt`);
}
console.log('Mini App built');
