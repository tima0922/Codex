import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('public', { recursive: true });
await build({ entryPoints: ['app/main.tsx'], bundle: true, minify: true, outfile: 'public/app.js', target: 'es2022', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' } });
await Promise.all(['index.html', 'style.css'].map(f => copyFile(`app/${f}`, `public/${f}`)));
console.log('Mini App built');
