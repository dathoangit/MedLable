import {
  createServer,
  type IncomingMessage,
  type ServerResponse
} from 'node:http';
import { LOOKUP_API_VERSION } from '../contracts/lookup.v1';
import { closePool, getPool, initPool } from '../db/pool';
import { loadConfig } from './config';
import { errorBody, logServerError } from './errors';
import { sendJson } from './http';
import { handleLookup } from './lookup-route';
import { clientAddress, RateLimiter } from './rate-limit';
import { isUpdateAsset, sendUpdateAsset } from './updates';

const config = loadConfig();
initPool({ statementTimeoutMs: config.statementTimeoutMs });

const limiter = new RateLimiter(config.rateLimitPerMinute);

let activeRequests = 0;
let shuttingDown = false;

const REQUEST_TIMEOUT_MESSAGE = 'Hết thời gian chờ. Thử lại sau.';
const SHUTTING_DOWN_MESSAGE = 'Server đang dừng. Thử lại sau.';

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

function lookupByFromUrl(reqUrl: URL): 'maHoSo' | 'maBenhAn' | 'none' {
  const hasMaHoSo =
    reqUrl.searchParams.has('ma-ho-so') || reqUrl.searchParams.has('maHoSo');
  const hasMaBenhAn =
    reqUrl.searchParams.has('ma-benh-an') ||
    reqUrl.searchParams.has('maBenhAn');
  if (hasMaHoSo && !hasMaBenhAn) {
    return 'maHoSo';
  }
  if (hasMaBenhAn && !hasMaHoSo) {
    return 'maBenhAn';
  }
  return 'none';
}

function logLookup(
  startedAt: number,
  status: number,
  by: 'maHoSo' | 'maBenhAn' | 'none',
  req: IncomingMessage
): void {
  const ms = Date.now() - startedAt;
  const ip = clientAddress(req);
  console.log(`lookup ms=${ms} status=${status} by=${by} ip=${ip}`);
}

const server = createServer((req, res) => {
  if (shuttingDown) {
    sendJson(res, 503, errorBody('INTERNAL', SHUTTING_DOWN_MESSAGE));
    return;
  }

  activeRequests += 1;
  const startedAt = Date.now();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    if (!res.headersSent) {
      sendJson(res, 503, errorBody('INTERNAL', REQUEST_TIMEOUT_MESSAGE));
    }
    req.destroy();
  }, config.requestTimeoutMs);

  void (async () => {
    const host = req.headers.host ?? `localhost:${config.port}`;
    const reqUrl = new URL(req.url ?? '/', `http://${host}`);
    let isLookup = false;

    try {
      if (req.method !== 'GET') {
        res.writeHead(405, { Allow: 'GET' }).end('Method not allowed');
        return;
      }

      if (reqUrl.pathname === '/health') {
        sendHealth(res, await databaseUp());
        return;
      }

      if (reqUrl.pathname === '/api/lookup') {
        isLookup = true;
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
    } catch (error: unknown) {
      logServerError(error);
      if (!res.headersSent) {
        sendJson(res, 500, errorBody('INTERNAL', 'Lỗi nội bộ.'));
      }
    } finally {
      clearTimeout(timer);
      if (isLookup && !timedOut) {
        logLookup(
          startedAt,
          res.statusCode || 500,
          lookupByFromUrl(reqUrl),
          req
        );
      } else if (isLookup && timedOut) {
        logLookup(startedAt, 503, lookupByFromUrl(reqUrl), req);
      }
      activeRequests -= 1;
    }
  })();
});

server.listen(config.port, config.bindHost, () => {
  console.log(`MedLabel API → http://${config.bindHost}:${config.port}`);
  console.log('GET /health');
  console.log('GET /api/lookup?ma-ho-so=… | ?ma-benh-an=…');
  console.log(`Updates → ${config.updateDir}`);
  console.log(
    `Timeouts → statement=${config.statementTimeoutMs}ms request=${config.requestTimeoutMs}ms drain=${config.shutdownDrainMs}ms`
  );
});

async function waitForDrain(deadlineMs: number): Promise<void> {
  const deadline = Date.now() + deadlineMs;
  while (activeRequests > 0 && Date.now() < deadline) {
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
  }
}

async function shutdown(): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log('MedLabel shutting down…');

  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });

  await waitForDrain(config.shutdownDrainMs);
  await closePool();
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});
