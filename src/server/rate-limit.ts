import type { IncomingMessage } from 'node:http';

export class RateLimiter {
  private readonly buckets = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs = 60_000
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const windowStart = now - this.windowMs;
    const recent = (this.buckets.get(key) ?? []).filter(
      (ts) => ts > windowStart
    );

    if (recent.length >= this.limit) {
      this.buckets.set(key, recent);
      this.prune(windowStart);
      return false;
    }

    recent.push(now);
    this.buckets.set(key, recent);
    return true;
  }

  private prune(windowStart: number): void {
    if (this.buckets.size < 5_000) {
      return;
    }
    for (const [key, timestamps] of this.buckets) {
      if (timestamps.every((ts) => ts <= windowStart)) {
        this.buckets.delete(key);
      }
    }
  }
}

/** Per-socket key. Do not trust X-Forwarded-For — clients can spoof it. */
export function clientAddress(req: IncomingMessage): string {
  return req.socket.remoteAddress ?? 'unknown';
}
