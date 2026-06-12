import * as http from 'http';
import { WEB_CONSOLE_DEFAULT_PORT } from './ensureWebConsoleRunning';

const startWebConsole = (accessKey: string, port: number): http.Server => {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
    const keyParam = url.searchParams.get('key');
    const authHeader = request.headers['authorization'];
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : null;

    if (keyParam !== accessKey && bearerToken !== accessKey) {
      response.writeHead(403, { 'content-type': 'text/plain' });
      response.end('Forbidden');
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true }));
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`web-console listening on 127.0.0.1:${port}`);
  });

  return server;
};

if (require.main === module) {
  const accessKey = process.env.WEB_CONSOLE_ACCESS_KEY ?? '';
  const port = process.env.WEB_CONSOLE_PORT
    ? Number(process.env.WEB_CONSOLE_PORT)
    : WEB_CONSOLE_DEFAULT_PORT;

  if (!accessKey) {
    console.error('WEB_CONSOLE_ACCESS_KEY environment variable is required');
    process.exit(1);
  }

  startWebConsole(accessKey, port);
}

export { startWebConsole };
