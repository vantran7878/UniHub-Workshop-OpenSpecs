import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/validations/prisma';
import { authenticateUser, requireRole } from '@/lib/auth/middleware';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = authenticateUser(req);
    if (!user || !requireRole(user, ['admin'])) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;

    const workshop = await prisma.workshop.findUnique({
      where: { id },
      include: {
        _count: {
          select: { registrations: true },
        },
      },
    });

    if (!workshop) {
      return NextResponse.json({ message: 'Workshop not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...workshop,
      registration_count: workshop._count.registrations,
      _count: undefined,
    });

  } catch (error) {
    console.error('Workshop detail retrieval error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
