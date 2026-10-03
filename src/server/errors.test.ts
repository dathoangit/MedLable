import assert from 'node:assert/strict';
import test from 'node:test';
import { LOOKUP_API_VERSION } from '../contracts/lookup.v1';
import { isDatabaseError, toPublicError } from './errors';

test('treats a Postgres SQLSTATE as a database error', () => {
  const error = Object.assign(
    new Error('relation "adempiere.his_patienthistory" does not exist'),
    {
      code: '42P01'
    }
  );
  assert.equal(isDatabaseError(error), true);
});

test('hides Postgres schema details from API clients', () => {
  const error = Object.assign(
    new Error('column his_patientdocument does not exist'),
    { code: '42703' }
  );
  const body = toPublicError(error);
  assert.equal(body.apiVersion, LOOKUP_API_VERSION);
  assert.equal(body.code, 'INTERNAL');
  assert.equal(body.error.includes('his_patientdocument'), false);
  assert.equal(body.error.includes('column'), false);
});

test('hides statement_timeout / query_canceled (57014) from API clients', () => {
  const error = Object.assign(
    new Error('canceling statement due to statement timeout'),
    { code: '57014' }
  );
  assert.equal(isDatabaseError(error), true);
  const body = toPublicError(error);
  assert.equal(body.code, 'INTERNAL');
  assert.equal(body.error.includes('timeout'), false);
  assert.equal(body.error.includes('canceling'), false);
});

test('keeps a deliberate validation message', () => {
  const body = toPublicError(new Error('Invalid mã hồ sơ.'), 'VALIDATION');
  assert.equal(body.code, 'VALIDATION');
  assert.equal(body.error, 'Invalid mã hồ sơ.');
});
