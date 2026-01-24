// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('token')?.value;

  // Public routes that don't need auth
  const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/company/setup', '/operator/signup'];
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    
    // Check role-based access
    if (pathname.startsWith('/company/admin')) {
      if (decodedToken.role !== 'company_admin') {
        return NextResponse.redirect(new URL('/login', req.url));
      }
    }

    if (pathname.startsWith('/company/operator/dashboard')) {
      if (decodedToken.role !== 'operator') {
        return NextResponse.redirect(new URL('/login', req.url));
      }
    }

    if (pathname.startsWith('/admin')) {
      if (decodedToken.role !== 'super_admin') {
        return NextResponse.redirect(new URL('/login', req.url));
      }
    }

  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/company/:path*',
    '/company/operator/dashboard/:path*',
    '/admin/:path*',
    '/dashboard/:path*'
  ],
};