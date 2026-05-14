import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/validations/prisma';
import { authenticateUser, requireRole } from '@/lib/auth/middleware';
import { z } from 'zod';

const AuditLogQuerySchema = z.object({
  action: z.string().optional(),
  actor_id: z.string().uuid().optional(),
  resource_id: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
});

export async function GET(req: NextRequest) {
  try {
    const user = authenticateUser(req);
    if (!user || !requireRole(user, ['admin'])) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const params = AuditLogQuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!params.success) {
      return NextResponse.json(
        { message: 'Invalid query parameters', errors: params.error.format() },
        { status: 400 }
      );
    }

    const { action, actor_id, resource_id, from, to, page, limit } = params.data;

    const where: any = {};
    if (action) where.action = action;
    if (actor_id) where.actorId = actor_id;
    if (resource_id) where.resourceId = resource_id;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      data: logs.map(log => ({
        id: log.id,
        action: log.action,
        resource_type: log.resourceType,
        resource_id: log.resourceId,
        actor: log.actor ? {
          id: log.actor.id,
          name: log.actor.name,
          email: log.actor.email,
        } : null,
        metadata: log.changes,
        old_values: log.oldValues,
        new_values: log.newValues,
        ip_address: log.ipAddress,
        user_agent: log.userAgent,
        created_at: log.createdAt,
      })),
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('Audit logs retrieval error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
