import {
  LOOKUP_API_VERSION,
  type ApiErrorCode,
  type LookupErrorResponse
} from '../contracts/lookup.v1';

const POSTGRES_SQLSTATE = /^[0-9A-Z]{5}$/;

const INTERNAL_MESSAGE = 'Không truy vấn được dữ liệu. Thử lại sau.';

export function isDatabaseError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && POSTGRES_SQLSTATE.test(code);
}

/**
 * Postgres driver messages include table and column names. Those stay in
 * the server log; clients only see a fixed sentence.
 */
export function toPublicError(
  error: unknown,
  fallbackCode: ApiErrorCode = 'INTERNAL'
): LookupErrorResponse {
  if (isDatabaseError(error)) {
    return {
      apiVersion: LOOKUP_API_VERSION,
      error: INTERNAL_MESSAGE,
      code: 'INTERNAL'
    };
  }

  if (error instanceof Error && fallbackCode !== 'INTERNAL') {
    return {
      apiVersion: LOOKUP_API_VERSION,
      error: error.message,
      code: fallbackCode
    };
  }

  return {
    apiVersion: LOOKUP_API_VERSION,
    error: INTERNAL_MESSAGE,
    code: 'INTERNAL'
  };
}

export function errorBody(
  code: ApiErrorCode,
  error: string
): LookupErrorResponse {
  return {
    apiVersion: LOOKUP_API_VERSION,
    error,
    code
  };
}

export function logServerError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error('MedLabel API error:', message);
}
