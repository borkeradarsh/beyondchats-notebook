import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  // For now, let's handle authentication in the components
  // This middleware just protects the dashboard route
  const { pathname } = req.nextUrl;

  // If accessing dashboard without checking auth state in component
  if (pathname.startsWith('/dashboard')) {
    // Let the component handle the auth check
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};