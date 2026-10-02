import { createServer, type ServerResponse } from 'node:http';
import { LOOKUP_API_VERSION } from '../contracts/lookup.v1';
import { closePool, getPool } from '../db/pool';
import { loadConfig } from './config';
import { errorBody, logServerError } from './errors';
import { sendJson } from './http';
import { handleLookup } from './lookup-route';
import { clientAddress, RateLimiter } from './rate-limit';
import { isUpdateAsset, sendUpdateAsset } from './updates';

const config = loadConfig();
const limiter = new RateLimiter(config.rateLimitPerMinute);

async function databaseUp(): Promise<boolean> {
  try {
    await getPool().query('SELECT 1');
    return true;
  } catch (error) {
    logServerError(error);
    return false;
  }
}

function sendHealth(res: ServerResponse, dbUp: boolean): void {
  sendJson(res, dbUp ? 200 : 503, {
    ok: dbUp,
    apiVersion: LOOKUP_API_VERSION,
    service: 'medlabel',
    db: dbUp ? 'up' : 'down'
  });
}

const server = createServer((req, res) => {
  void (async () => {
    const host = req.headers.host ?? `localhost:${config.port}`;
    const reqUrl = new URL(req.url ?? '/', `http://${host}`);

    if (req.method !== 'GET') {
      res.writeHead(405, { Allow: 'GET' }).end('Method not allowed');
      return;
    }

    if (reqUrl.pathname === '/health') {
      sendHealth(res, await databaseUp());
      return;
    }

    if (reqUrl.pathname === '/api/lookup') {
      if (!limiter.allow(clientAddress(req))) {
        sendJson(
          res,
          429,
          errorBody('RATE_LIMIT', 'Quá nhiều yêu cầu. Thử lại sau.')
        );
        return;
      }
      await handleLookup(reqUrl, res);
      return;
    }

    if (isUpdateAsset(reqUrl.pathname)) {
      await sendUpdateAsset(config.updateDir, reqUrl.pathname, res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  })().catch((error: unknown) => {
    logServerError(error);
    if (!res.headersSent) {
      sendJson(res, 500, errorBody('INTERNAL', 'Lỗi nội bộ.'));
    }
  });
});

server.listen(config.port, config.bindHost, () => {
  console.log(`MedLabel API → http://${config.bindHost}:${config.port}`);
  console.log('GET /health');
  console.log('GET /api/lookup?ma-ho-so=… | ?ma-benh-an=…');
  console.log(`Updates → ${config.updateDir}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await closePool();
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});
