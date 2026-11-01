import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('public', { recursive: true });
await build({ entryPoints: ['app/main.tsx'], bundle: true, minify: true, splitting: true, format: 'esm', outdir: 'public', entryNames: 'app', chunkNames: 'chunks/[name]-[hash]', target: 'es2022', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' } });
await Promise.all(['index.html', 'style.css', 'neon.css'].map(f => copyFile(`app/${f}`, `public/${f}`)));
await mkdir('public/fonts', {recursive:true});
for (const family of ['manrope', 'unbounded']) {
 for (const subset of ['latin', 'cyrillic']) await copyFile(`node_modules/@fontsource-variable/${family}/files/${family}-${subset}-wght-normal.woff2`, `public/fonts/${family}-${subset}.woff2`);
 await copyFile(`node_modules/@fontsource-variable/${family}/LICENSE`, `public/fonts/${family}-LICENSE.txt`);
}
console.log('Mini App built');
