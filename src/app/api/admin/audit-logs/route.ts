import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/validations/prisma';
import { authenticateUser, requireRole } from '@/lib/auth/middleware';
import { z } from 'zod';

const AuditLogQuerySchema = z.object({
  entity_type: z.string().optional(),
  entity_id: z.string().uuid().optional(),
  event_type: z.string().optional(),
  admin_id: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
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

    const { entity_type, entity_id, event_type, admin_id, from, to, page, limit } = params.data;

    const where: any = {};
    if (event_type) where.action = event_type;
    if (admin_id) where.actorId = admin_id;
    if (entity_type) where.resourceType = entity_type;
    if (entity_id) where.resourceId = entity_id;
    
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
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      data: logs.map(log => ({
        id: log.id,
        event_type: log.action,
        entity_type: log.resourceType,
        entity_id: log.resourceId,
        metadata: {
          ...(log.changes as any || {}),
          old_value: log.oldValues,
          new_value: log.newValues,
        },
        ip_address: log.ipAddress,
        created_at: log.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
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
