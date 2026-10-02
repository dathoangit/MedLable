import { readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { basename, extname, join } from 'node:path';

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

const MIME: Record<string, string> = {
  '.xml': 'application/xml; charset=utf-8',
  '.crx': 'application/x-chrome-extension'
};

export function isUpdateAsset(pathname: string): boolean {
  const name = basename(pathname);
  if (pathname !== `/${name}`) {
    return false;
  }
  if (!SAFE_NAME.test(name)) {
    return false;
  }
  return name === 'updates.xml' || extname(name) === '.crx';
}

export async function sendUpdateAsset(
  updateDir: string,
  pathname: string,
  res: ServerResponse
): Promise<void> {
  const name = basename(pathname);
  const filePath = join(updateDir, name);
  try {
    const data = await readFile(filePath);
    const type = MIME[extname(name)] ?? 'application/octet-stream';
    const cache =
      extname(name) === '.xml' ? 'no-cache' : 'public, max-age=86400';
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': cache,
      'Content-Length': data.length
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}
