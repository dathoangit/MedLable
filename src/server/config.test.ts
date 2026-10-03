import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from './config';

test('loadConfig applies timeout and drain defaults', () => {
  const config = loadConfig({
    UPDATE_DIR: 'updates'
  });
  assert.equal(config.statementTimeoutMs, 8000);
  assert.equal(config.requestTimeoutMs, 10_000);
  assert.equal(config.shutdownDrainMs, 10_000);
  assert.equal(config.port, 8080);
  assert.equal(config.rateLimitPerMinute, 60);
});

test('loadConfig reads timeout env overrides', () => {
  const config = loadConfig({
    UPDATE_DIR: 'updates',
    STATEMENT_TIMEOUT_MS: '5000',
    REQUEST_TIMEOUT_MS: '12000',
    SHUTDOWN_DRAIN_MS: '3000'
  });
  assert.equal(config.statementTimeoutMs, 5000);
  assert.equal(config.requestTimeoutMs, 12_000);
  assert.equal(config.shutdownDrainMs, 3000);
});

test('loadConfig rejects non-positive STATEMENT_TIMEOUT_MS', () => {
  assert.throws(
    () =>
      loadConfig({
        UPDATE_DIR: 'updates',
        STATEMENT_TIMEOUT_MS: '0'
      }),
    /STATEMENT_TIMEOUT_MS/
  );
});

test('loadConfig rejects invalid REQUEST_TIMEOUT_MS', () => {
  assert.throws(
    () =>
      loadConfig({
        UPDATE_DIR: 'updates',
        REQUEST_TIMEOUT_MS: 'abc'
      }),
    /REQUEST_TIMEOUT_MS/
  );
});
