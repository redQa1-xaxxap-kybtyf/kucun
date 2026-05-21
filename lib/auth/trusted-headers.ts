import { env } from '@/lib/env';

export const AUTH_VERIFICATION_HEADER = 'x-auth-verified';

export const AUTH_HEADER_NAMES = [
  'x-user-id',
  'x-user-email',
  'x-user-name',
  'x-user-username',
  'x-user-role',
  'x-user-status',
  'x-session-id',
  AUTH_VERIFICATION_HEADER,
] as const;

export function getAuthVerificationHeaderValue(): string {
  return `trusted_${env.NEXTAUTH_SECRET.slice(0, 32)}`;
}

export function hasTrustedAuthHeaders(headers: Headers): boolean {
  return (
    headers.get(AUTH_VERIFICATION_HEADER) === getAuthVerificationHeaderValue()
  );
}

export function clearAuthHeaders(headers: Headers): void {
  for (const headerName of AUTH_HEADER_NAMES) {
    headers.delete(headerName);
  }
}
