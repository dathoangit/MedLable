import { createServer, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePool } from '../src/db/pool';
import {
  lookupByMaBenhAn,
  lookupByMaHoSo,
  parseMaBenhAn,
  parseMaHoSo
} from '../src/db/lookup';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const UI_DIR = join(ROOT, 'test-ui');
const PORT = Number(process.env.PORT || 4177);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(payload);
}

async function handleLookup(reqUrl: URL, res: ServerResponse): Promise<void> {
  const maHoSoRaw =
    reqUrl.searchParams.get('ma-ho-so') ??
    reqUrl.searchParams.get('maHoSo') ??
    '';
  const maBenhAnRaw =
    reqUrl.searchParams.get('ma-benh-an') ??
    reqUrl.searchParams.get('maBenhAn') ??
    '';

  if (maHoSoRaw && maBenhAnRaw) {
    sendJson(res, 400, {
      error: 'Chỉ gửi một trong hai: ma-ho-so hoặc ma-benh-an.'
    });
    return;
  }

  if (!maHoSoRaw && !maBenhAnRaw) {
    sendJson(res, 400, {
      error: 'Thiếu tham số ma-ho-so hoặc ma-benh-an.'
    });
    return;
  }

  try {
    if (maHoSoRaw) {
      const parsed = parseMaHoSo(maHoSoRaw);
      if (!parsed.ok) {
        sendJson(res, 400, { error: parsed.error });
        return;
      }

      const result = await lookupByMaHoSo(parsed.maHoSo);
      if (!result) {
        sendJson(res, 404, {
          error: `Không tìm thấy mã hồ sơ ${parsed.maHoSo} (his_patientdocument). Không dùng mã NB.`
        });
        return;
      }

      sendJson(res, 200, {
        lookupBy: 'maHoSo',
        dateHint: parsed.dateHint,
        orderCount: result.orders.length,
        medicationCount: result.orders.reduce(
          (sum, order) => sum + order.medicationCount,
          0
        ),
        patient: result.patient,
        orders: result.orders,
        matchCount: result.matchCount
      });
      return;
    }

    const parsedBa = parseMaBenhAn(maBenhAnRaw);
    if (!parsedBa.ok) {
      sendJson(res, 400, { error: parsedBa.error });
      return;
    }

    const result = await lookupByMaBenhAn(parsedBa.maBenhAn);
    if (!result) {
      sendJson(res, 404, {
        error: `Không tìm thấy mã bệnh án ${parsedBa.maBenhAn} (his_medicalrecordno).`
      });
      return;
    }

    sendJson(res, 200, {
      lookupBy: 'maBenhAn',
      orderCount: result.orders.length,
      medicationCount: result.orders.reduce(
        (sum, order) => sum + order.medicationCount,
        0
      ),
      patient: result.patient,
      orders: result.orders,
      matchCount: result.matchCount
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: message });
  }
}

async function handleStatic(
  pathname: string,
  res: ServerResponse
): Promise<void> {
  const relative =
    pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  if (relative.includes('..')) {
    res.writeHead(400).end('Bad path');
    return;
  }

  const filePath = join(UI_DIR, relative);
  try {
    const data = await readFile(filePath);
    const type = MIME[extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

const server = createServer((req, res) => {
  void (async () => {
    const host = req.headers.host ?? `localhost:${PORT}`;
    const reqUrl = new URL(req.url ?? '/', `http://${host}`);

    if (req.method === 'GET' && reqUrl.pathname === '/api/lookup') {
      await handleLookup(reqUrl, res);
      return;
    }

    if (req.method === 'GET') {
      await handleStatic(reqUrl.pathname, res);
      return;
    }

    res.writeHead(405).end('Method not allowed');
  })().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: message });
  });
});

server.listen(PORT, () => {
  console.log(`MedLabel test UI → http://localhost:${PORT}`);
  console.log('Lookup API → GET /api/lookup?ma-ho-so=… | ?ma-benh-an=…');
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
