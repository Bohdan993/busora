import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Every path except /api (rewritten to the booking API), Next.js internals
  // and files with an extension (favicon.ico, images)
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)'
};
