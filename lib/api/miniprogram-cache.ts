import type { NextResponse } from 'next/server';

const MINI_PROGRAM_PUBLIC_CACHE_SECONDS = 30;
const MINI_PROGRAM_PUBLIC_STALE_SECONDS = 60;

export function setMiniProgramPublicCacheHeaders(response: NextResponse) {
  response.headers.set(
    'Cache-Control',
    [
      'public',
      `max-age=${MINI_PROGRAM_PUBLIC_CACHE_SECONDS}`,
      `s-maxage=${MINI_PROGRAM_PUBLIC_CACHE_SECONDS}`,
      `stale-while-revalidate=${MINI_PROGRAM_PUBLIC_STALE_SECONDS}`,
    ].join(', ')
  );
  response.headers.set('Vary', 'x-client-from');
  return response;
}
