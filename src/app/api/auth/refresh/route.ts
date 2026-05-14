import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshTokenHash,
  deleteRefreshTokenHash,
  verifyRefreshTokenHash
} from '@/lib/auth/tokens';
import { refreshRateLimiter, checkRateLimit } from '@/lib/rate-limiter';
import { auditLog } from '@/lib/auth/audit';

export async function POST(req: NextRequest) {
  try {
    const ipAddress = req.ip || req.headers.get('x-forwarded-for') || null;
    const userAgent = req.headers.get('user-agent') || null;
    
    // Apply rate limit
    const rateLimitResponse = await checkRateLimit(refreshRateLimiter, ipAddress);
    if (rateLimitResponse) return rateLimitResponse;

    const refreshTokenCookie = req.cookies.get('refresh_token');
    if (!refreshTokenCookie || !refreshTokenCookie.value) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const oldRefreshToken = refreshTokenCookie.value;

    // Verify token
    let userId: string | null = null;
    try {
      userId = await verifyRefreshTokenHash(oldRefreshToken);
    } catch (e) {
      console.error('Redis error during refresh verification:', e);
      return NextResponse.json({ message: 'Service Unavailable' }, { status: 503 });
    }

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Token Rotation
    try {
      await deleteRefreshTokenHash(oldRefreshToken);
    } catch (e) {
      console.error('Redis error during old token deletion:', e);
      return NextResponse.json({ message: 'Service Unavailable' }, { status: 503 });
    }

    const newAccessToken = generateAccessToken({ sub: user.id, role: user.role });
    const newRefreshToken = generateRefreshToken();

    try {
      await storeRefreshTokenHash(user.id, newRefreshToken);
    } catch (e) {
      console.error('Redis error during new token storage:', e);
      return NextResponse.json({ message: 'Service Unavailable' }, { status: 503 });
    }

    // Audit Log
    auditLog('TOKEN_REFRESH', { user_id: user.id, ip: ipAddress }, { userId: user.id, ipAddress, userAgent });

    // Response
    const response = NextResponse.json(
      {
        access_token: newAccessToken,
        token_type: 'Bearer',
        expires_in: 900,
      },
      { status: 200 }
    );

    response.cookies.set({
      name: 'refresh_token',
      value: newRefreshToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
