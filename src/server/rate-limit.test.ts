import assert from 'node:assert/strict';
import test from 'node:test';
import { RateLimiter } from './rate-limit';

test('allows up to the configured number of calls in the window', () => {
  const limiter = new RateLimiter(2, 60_000);
  const now = 1_000_000;
  assert.equal(limiter.allow('10.0.0.8', now), true);
  assert.equal(limiter.allow('10.0.0.8', now + 1), true);
  assert.equal(limiter.allow('10.0.0.8', now + 2), false);
});

test('does not let one client consume another client budget', () => {
  const limiter = new RateLimiter(1, 60_000);
  assert.equal(limiter.allow('10.0.0.1', 0), true);
  assert.equal(limiter.allow('10.0.0.2', 0), true);
  assert.equal(limiter.allow('10.0.0.1', 1), false);
});

test('accepts a call again after the window slides', () => {
  const limiter = new RateLimiter(1, 1_000);
  assert.equal(limiter.allow('10.0.0.1', 0), true);
  assert.equal(limiter.allow('10.0.0.1', 1_001), true);
});
