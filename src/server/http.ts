import type { ServerResponse } from 'node:http';

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown
): void {
  if (res.headersSent) {
    return;
  }
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(payload);
}
