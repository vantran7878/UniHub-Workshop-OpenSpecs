import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcrypt';
import { RegisterSchema } from '@/lib/validations/auth';
import { registerRateLimiter, checkRateLimit } from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
  try {
    const ipAddress = req.ip || req.headers.get('x-forwarded-for') || null;
    
    // Apply rate limit
    const rateLimitResponse = await checkRateLimit(registerRateLimiter, ipAddress);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();

    const validationResult = RegisterSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          message: 'Validation error',
          errors: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { email, password, full_name } = validationResult.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: 'Email already exists' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          fullName: full_name,
          role: Role.student,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'REGISTER_SUCCESS',
          actorId: user.id,
          resourceType: 'User',
          resourceId: user.id,
          userAgent: req.headers.get('user-agent') || null,
        },
      });

      return user;
    });

    return NextResponse.json(
      {
        message: 'Registration successful',
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.fullName,
          role: newUser.role,
          isActive: newUser.isActive,
          createdAt: newUser.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}