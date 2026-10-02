import { resolve } from 'node:path';

export type ServerConfig = {
  port: number;
  bindHost: string;
  updateDir: string;
  rateLimitPerMinute: number;
};

function readPort(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT "${raw}". Expected an integer 1–65535.`);
  }
  return port;
}

function readPositiveInt(
  raw: string | undefined,
  fallback: number,
  name: string
): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid ${name} "${raw}". Expected a positive integer.`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: readPort(env.PORT, 8080),
    bindHost: env.BIND_HOST?.trim() || '0.0.0.0',
    updateDir: resolve(process.cwd(), env.UPDATE_DIR?.trim() || 'updates'),
    rateLimitPerMinute: readPositiveInt(
      env.RATE_LIMIT_PER_MINUTE,
      60,
      'RATE_LIMIT_PER_MINUTE'
    )
  };
}
