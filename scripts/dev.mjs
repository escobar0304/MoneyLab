import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const embedPort = Number(process.env.VITE_EMBED_PORT || 5174);
const embedHost = process.env.VITE_EMBED_HOST || 'localhost';
const publicDirectory = new URL('../public/', import.meta.url);
const embedPolicy = "default-src 'none'; script-src 'self' blob: https://s3.tradingview.com https://*.tradingview.com; worker-src blob: https://*.tradingview.com; child-src blob: https://*.tradingview.com; style-src 'self' 'unsafe-inline'; img-src data: blob: https://*.tradingview.com; font-src https://*.tradingview.com data:; connect-src https://*.tradingview.com wss://*.tradingview.com; frame-src https://*.tradingview.com https://tradingview-widget.com https://*.tradingview-widget.com; base-uri 'none'; form-action 'none'";
const assets = new Map([
  ['/embed.html', ['embed.html', 'text/html; charset=utf-8']],
  ['/embed.js', ['embed.js', 'text/javascript; charset=utf-8']],
]);

const embedServer = createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  const asset = assets.get(pathname);
  if (request.method !== 'GET' || !asset) {
    response.writeHead(404).end();
    return;
  }

  try {
    const contents = await readFile(new URL(asset[0], publicDirectory));
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': embedPolicy,
      'Content-Type': asset[1],
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(contents);
  } catch {
    response.writeHead(500).end();
  }
});

await new Promise((resolve, reject) => {
  embedServer.once('error', reject);
  embedServer.listen(embedPort, embedHost, resolve);
});
console.log(`TradingView embed server: http://localhost:${embedPort}`);

const viteCli = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const vite = spawn(process.execPath, [viteCli, ...process.argv.slice(2)], {
  env: { ...process.env, VITE_EMBED_PORT: String(embedPort) },
  stdio: 'inherit',
});
let stopping = false;

function stop(signal) {
  if (stopping) return;
  stopping = true;
  embedServer.close();
  vite.kill(signal);
}

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));
vite.once('error', (error) => {
  console.error(error);
  embedServer.close();
  process.exitCode = 1;
});
vite.once('exit', (code) => {
  embedServer.close();
  if (!stopping) process.exitCode = code ?? 1;
});
