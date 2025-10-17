import NextAuth from '@/lib/auth';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';

const authHandler = NextAuth;

export const GET = withRateLimit(RateLimitType.AUTH)(authHandler);
export const POST = withRateLimit(RateLimitType.AUTH)(authHandler);
