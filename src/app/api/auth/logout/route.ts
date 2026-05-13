import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteRefreshTokenHash } from '@/lib/auth/tokens';
import * as jwt from 'jsonwebtoken';

// Note: JWT keys should be correctly formatted strings containing line breaks
const publicKey = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n') || '';

export async function POST(req: NextRequest) {
  try {
    // Verify the Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = authHeader.split(' ')[1];
    let decodedToken: any;

    try {
      decodedToken = jwt.verify(accessToken, publicKey, { algorithms: ['RS256'] });
    } catch (e) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const userId = decodedToken.sub;

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
    const ipAddress = req.ip || req.headers.get('x-forwarded-for') || null;
    const userAgent = req.headers.get('user-agent') || null;

    try {
      await prisma.auditLog.create({
        data: {
          action: 'LOGOUT',
          actorId: userId,
          resourceType: 'User',
          resourceId: userId,
          ipAddress,
          userAgent,
        },
      });
    } catch (e) {
      console.error('Failed to log audit event', e);
    }

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
