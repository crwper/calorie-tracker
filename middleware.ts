import { type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// Run on all app routes except static assets/images/etc.
export const config = {
  matcher: [
    '/((?!_next/|icon$|manifest\\.webmanifest$|robots\\.txt$|sitemap\\.xml$|.*\\.(?:css|js|map|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2)$).*)',
  ],
};
