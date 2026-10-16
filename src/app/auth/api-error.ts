import { HttpErrorResponse } from '@angular/common/http';

/**
 * Turns a backend error into one readable message.
 * Backend formats: { message: "..." } for auth errors,
 * { field: "message" } for validation errors (400).
 */
export function apiErrorMessage(error: HttpErrorResponse, fallback: string): string {
  if (error.status === 0) {
    return 'Server is not reachable. Please try again later.';
  }

  const body: unknown = error.error;
  if (body && typeof body === 'object') {
    const fields = body as Record<string, unknown>;
    if (typeof fields['message'] === 'string') {
      return fields['message'];
    }
    const messages = Object.entries(fields)
      .filter(([, value]) => typeof value === 'string')
      .map(([field, value]) => `${field}: ${value}`);
    if (messages.length > 0) {
      return messages.join('\n');
    }
  }

  return fallback;
}
