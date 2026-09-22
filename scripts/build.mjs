import { build } from 'esbuild';
import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const base = '/Viziunea/';
await mkdir('dist/src/services', { recursive: true });
const result = await build({ entryPoints: ['src/main.js'], bundle: true, format: 'esm', target: 'es2022', external: ['https://*'], write: false });
const js = result.outputFiles[0].contents;
const css = await readFile('styles.css');
const hash = createHash('sha256').update(js).update(css).digest('hex').slice(0, 12);
await writeFile(`dist/src/services/app-${hash}.js`, js);
await writeFile(`dist/styles-${hash}.css`, css);
await cp('assets', 'dist/assets', { recursive: true });
await cp('manifest.webmanifest', 'dist/manifest.webmanifest');
const template = await readFile('index.html', 'utf8');
const html = template.replace('<head>', `<head>\n  <base href="${base}">`)
  .replace(/href="styles\.css[^\"]*"/, `href="styles-${hash}.css"`)
  .replace(/src="src\/main\.js[^\"]*"/, `src="src/services/app-${hash}.js"`);
const routes = ['', 'auth', 'admin', 'profil', 'feed', 'exploreaza', 'mesaje', 'notificari', 'setari', 'despre', 'resurse', 'directii', ...['arta','educatie','turism','interventie-culturala','servicii-creative-suport','spatii-art-hub'].map(x=>`directii/${x}`)];
for (const route of routes) {
  await mkdir(`dist/${route}`, { recursive: true });
  await writeFile(`dist/${route ? route+'/' : ''}index.html`, html);
}
await writeFile('dist/404.html', html);
await writeFile('dist/.nojekyll', '');
await writeFile('dist/version.json', JSON.stringify({ version: hash, commit: process.env.GITHUB_SHA || 'local' }));
console.log(`Built ${hash}: ${routes.length} routes`);
