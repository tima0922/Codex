import { build, transform } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
// public is generated; remove old hashed chunks so obsolete clients never ship.
await rm('public', { recursive: true, force: true });
await mkdir('public', { recursive: true });
const bundle = await build({ entryPoints: ['app/main.tsx'], bundle: true, minify: true, splitting: true, format: 'esm', outdir: 'public', entryNames: 'app-[hash]', chunkNames: 'chunks/[name]-[hash]', metafile: true, target: 'es2022', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' } });
const entry = Object.entries(bundle.metafile.outputs).find(([,info]) => info.entryPoint === 'app/main.tsx')?.[0];
if (!entry) throw new Error('Missing client entry');
const css = (await transform(await readFile('app/style.css','utf8'), { loader:'css', minify:true, target:['chrome100','safari15'] })).code;
const styleHash=createHash('sha256').update(css).digest('hex').slice(0,12);
await writeFile(`public/style-${styleHash}.css`,css);
let html=await readFile('app/index.html','utf8');
html=html.replace('/app.js?v=glass','/'+entry.replace(/^public\//,'')).replace('/style.css?v=glass',`/style-${styleHash}.css`);
await writeFile('public/index.html',html);
await mkdir('public/fonts',{recursive:true});
for(const family of ['golos-text','manrope']){
 for(const subset of ['latin','cyrillic'])await copyFile(`node_modules/@fontsource-variable/${family}/files/${family}-${subset}-wght-normal.woff2`,`public/fonts/${family}-${subset}.woff2`);
 await copyFile(`node_modules/@fontsource-variable/${family}/LICENSE`,`public/fonts/${family}-LICENSE.txt`);
}
const sizes=await Promise.all(Object.keys(bundle.metafile.outputs).map(async path=>{const bytes=await readFile(path);return {path,raw:bytes.length,gzip:gzipSync(bytes).length}}));
console.log('Mini App built · Glass');
for(const item of sizes)console.log(`${item.path}: ${(item.raw/1024).toFixed(1)} KB / ${(item.gzip/1024).toFixed(1)} KB gzip`);
console.log(`CSS: ${(Buffer.byteLength(css)/1024).toFixed(1)} KB / ${(gzipSync(css).length/1024).toFixed(1)} KB gzip`);
