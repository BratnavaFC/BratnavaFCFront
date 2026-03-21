import { extractApiError } from '../lib/apiError';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  message: string | null;
  error: string | null;
  errors: string[];
}

/**
 * Extracts a user-readable error message from an Axios error.
 * Prefers the ApiResponse envelope; falls back to extractApiError for
 * non-envelope responses (network errors, legacy endpoints, etc.).
 */
export function getResponseMessage(
  e: unknown,
  fallback = 'Ocorreu um erro inesperado.'
): string {
  const data = (e as any)?.response?.data as ApiResponse | undefined;
  // Detect envelope shape
  if (data && typeof data.success === 'boolean') {
    if (data.error) return data.error;
    if (data.errors?.length) return data.errors[0];
  }
  return extractApiError(e, fallback);
}
