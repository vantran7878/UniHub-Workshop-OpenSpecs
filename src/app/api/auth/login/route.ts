import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcrypt';
import { LoginSchema } from '@/lib/validations/auth';
import { generateAccessToken, generateRefreshToken, storeRefreshTokenHash } from '@/lib/auth/tokens';
import { loginRateLimiter, checkRateLimit } from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
  try {
    const ipAddress = req.ip || req.headers.get('x-forwarded-for') || null;
    
    // Apply rate limit
    const rateLimitResponse = await checkRateLimit(loginRateLimiter, ipAddress);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();

    const validationResult = LoginSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { message: 'Validation error', errors: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;
    const userAgent = req.headers.get('user-agent') || null;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      await logAuditFailure(null, ipAddress, userAgent);
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    
    if (!passwordMatch) {
      await logAuditFailure(user.id, ipAddress, userAgent);
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    // Authentication successful
    await prisma.auditLog.create({
      data: {
        action: 'LOGIN_SUCCESS',
        actorId: user.id,
        resourceType: 'User',
        resourceId: user.id,
        ipAddress,
        userAgent,
      },
    });

    const accessToken = generateAccessToken({ sub: user.id, role: user.role });
    const refreshToken = generateRefreshToken();

    await storeRefreshTokenHash(user.id, refreshToken);

    const response = NextResponse.json(
      {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 900, // 15 minutes
      },
      { status: 200 }
    );

    response.cookies.set({
      name: 'refresh_token',
      value: refreshToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function logAuditFailure(userId: string | null, ipAddress: string | null, userAgent: string | null) {
  try {
    await prisma.auditLog.create({
      data: {
        action: 'LOGIN_FAILURE',
        actorId: userId,
        resourceType: 'User',
        resourceId: userId,
        ipAddress,
        userAgent,
      },
    });
  } catch (e) {
    console.error('Failed to log audit failure', e);
  }
}
