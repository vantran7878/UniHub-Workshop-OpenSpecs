import { NextRequest, NextResponse } from 'next/server';
import { deleteRefreshTokenHash } from '@/lib/auth/tokens';
import { authenticateUser } from '@/lib/auth/middleware';
import { auditLog } from '@/lib/auth/audit';

export async function POST(req: NextRequest) {
  try {
    const ipAddress = req.ip || req.headers.get('x-forwarded-for') || null;
    const userAgent = req.headers.get('user-agent') || null;

    const user = authenticateUser(req);
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.sub;

    // Read refresh token from cookies
    const refreshTokenCookie = req.cookies.get('refresh_token');

    if (refreshTokenCookie && refreshTokenCookie.value) {
      try {
        await deleteRefreshTokenHash(refreshTokenCookie.value);
      } catch (e) {
        console.error('Failed to delete refresh token from Redis during logout', e);
        // Continue with logout even if Redis deletion fails
      }
    }

    // Audit Log
    auditLog('LOGOUT', { user_id: userId, ip: ipAddress }, { userId, ipAddress, userAgent });

    // Clear cookie and return 204
    const response = new NextResponse(null, { status: 204 });
    response.cookies.set({
      name: 'refresh_token',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
