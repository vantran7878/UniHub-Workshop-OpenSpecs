import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/validations/prisma';
import { authenticateUser, requireRole } from '@/lib/auth/middleware';
import { CreateWorkshopSchema, WorkshopQuerySchema } from '@/lib/validations/workshop';
import { auditLog } from '@/lib/auth/audit';

export async function POST(req: NextRequest) {
  try {
    const user = authenticateUser(req);
    if (!user || !requireRole(user, ['admin'])) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validationResult = CreateWorkshopSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { message: 'Validation error', errors: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { title, description, location, starts_at, ends_at, capacity, pricing_type } = validationResult.data;
    const ipAddress = req.ip || req.headers.get('x-forwarded-for') || null;
    const userAgent = req.headers.get('user-agent') || null;

    // Mapping 'starts_at' to 'startTime' and 'ends_at' to 'endTime' as per Prisma schema
    const workshop = await prisma.workshop.create({
      data: {
        title,
        description,
        room: location,
        startTime: new Date(starts_at),
        endTime: new Date(ends_at),
        capacity,
        isPaid: pricing_type === 'paid',
        status: 'active', // 'draft' is not in current Prisma enum, using 'active'
        registrationOpenAt: new Date(),
        createdBy: user.sub,
      },
    });

    // Async audit log
    auditLog('WORKSHOP_CREATED', 
      { workshop_id: workshop.id, title: workshop.title, created_by: user.sub, ip: ipAddress }, 
      { userId: user.sub, resourceType: 'Workshop', resourceId: workshop.id, ipAddress, userAgent }
    );

    return NextResponse.json(workshop, { status: 201 });

  } catch (error) {
    console.error('Workshop creation error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = authenticateUser(req);
    if (!user || !requireRole(user, ['admin'])) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const queryResult = WorkshopQuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!queryResult.success) {
      return NextResponse.json(
        { message: 'Invalid query parameters', errors: queryResult.error.format() },
        { status: 400 }
      );
    }

    const { status, pricing_type, from, to, page, limit } = queryResult.data;

    const where: any = {};
    if (status) where.status = status;
    if (pricing_type) where.isPaid = pricing_type === 'paid';
    if (from || to) {
      where.startTime = {};
      if (from) where.startTime.gte = new Date(from);
      if (to) where.startTime.lte = new Date(to);
    }

    const [total, data] = await Promise.all([
      prisma.workshop.count({ where }),
      prisma.workshop.findMany({
        where,
        skip: (page - 1) * (limit || 20),
        take: limit || 20,
        orderBy: { startTime: 'desc' },
        include: {
          _count: {
            select: { registrations: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      data: data.map((w: any) => ({
        ...w,
        registration_count: w._count.registrations,
        _count: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
      },
    });

  } catch (error) {
    console.error('Workshop listing error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
