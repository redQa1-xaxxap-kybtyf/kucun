import { sanitizeInternalPath } from '@/lib/utils/safe-navigation';

import SignInPageClient from './sign-in-page-client';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rawCallbackUrl = params.callbackUrl;
  const rawError = params.error;

  const callbackUrl = sanitizeInternalPath(
    Array.isArray(rawCallbackUrl) ? rawCallbackUrl[0] : rawCallbackUrl,
    '/dashboard'
  );
  const error = Array.isArray(rawError) ? rawError[0] : rawError;

  return <SignInPageClient callbackUrl={callbackUrl} error={error} />;
}
