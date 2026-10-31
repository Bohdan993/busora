import createClient from 'openapi-fetch';
import type { components, paths } from './schema';

export type Schemas = components['schemas'];

/** API error codes, plus NETWORK_ERROR when the API could not be reached. */
export type ApiErrorCode = Schemas['ErrorResponse']['code'] | 'NETWORK_ERROR';

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly status: number,
    message: string,
    readonly errors?: Schemas['ErrorResponse']['errors']
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field → localised messages, as POST /api/passengers/validate returns them. */
  get fieldErrors(): Record<string, string[]> {
    return this.errors && !Array.isArray(this.errors) ? this.errors : {};
  }
}

// Same origin: Next.js forwards /api/* to the booking API (next.config.ts)
export const api = createClient<paths>({
  baseUrl: '',
  credentials: 'same-origin'
});

const isErrorResponse = (body: unknown): body is Schemas['ErrorResponse'] =>
  typeof body === 'object' && body !== null && 'code' in body;

/**
 * Returns the response body of an openapi-fetch call, or throws an ApiError
 * that carries the API's machine-readable code.
 */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>
): Promise<T> {
  let result: Awaited<typeof call>;
  try {
    result = await call;
  } catch (cause) {
    throw new ApiError('NETWORK_ERROR', 0, String(cause));
  }
  const { data, error, response } = result;
  if (response.ok && data !== undefined) return data;
  if (isErrorResponse(error)) {
    throw new ApiError(
      error.code,
      response.status,
      error.message,
      error.errors
    );
  }
  // Not the API's JSON (e.g. the proxy could not reach it)
  throw new ApiError(
    response.status >= 500 ? 'SERVER_ERROR' : 'NETWORK_ERROR',
    response.status,
    `Unexpected response ${response.status}`
  );
}
