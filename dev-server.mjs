import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.png':'image/png', '.webmanifest':'application/manifest+json' };
const port = Number(process.env.PORT || 4173);

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const requested = normalize(join(root, pathname));
  const fallbackAsset = pathname.split('/').slice(2).join('/');
  const file = requested.startsWith(root) ? requested : join(root, 'index.html');
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    let body, servedFile;
    try { servedFile = join(root, fallbackAsset); body = await readFile(servedFile); }
    catch { servedFile = join(root, 'index.html'); body = await readFile(servedFile); }
    response.writeHead(200, { 'Content-Type': types[extname(servedFile)] || 'application/octet-stream' });
    response.end(body);
  }
}).listen(port, () => console.log(`Viziunea local: http://localhost:${port}/`));
