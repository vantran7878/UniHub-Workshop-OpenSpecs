import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/validations/prisma';
import { authenticateUser, requireRole } from '@/lib/auth/middleware';
import { UpdateWorkshopSchema } from '@/lib/validations/workshop';
import { auditLog } from '@/lib/auth/audit';


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
        pricing: true,
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
      pricing: workshop.pricing ? {
        base_price: workshop.pricing.basePrice,
        currency: workshop.pricing.currency,
        early_bird_price: workshop.pricing.earlyBirdPrice,
        early_bird_deadline: workshop.pricing.earlyBirdDeadline,
      } : null,
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


export async function PUT(
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

    if (workshop.status === 'cancelled') {
      return NextResponse.json({ message: 'Cannot update cancelled workshop' }, { status: 409 });
    }

    const body = await req.json();
    const validationResult = UpdateWorkshopSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { message: 'Validation error', errors: validationResult.error.format() },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const currentRegistrations = workshop._count.registrations;

    if (data.capacity !== undefined && data.capacity < currentRegistrations) {
      return NextResponse.json(
        { message: `Capacity cannot be less than current registration count (${currentRegistrations})` },
        { status: 400 }
      );
    }

    // Check for critical changes that trigger notification
    const criticalFieldsChanged =
      (data.starts_at && new Date(data.starts_at).getTime() !== workshop.startTime.getTime()) ||
      (data.ends_at && new Date(data.ends_at).getTime() !== workshop.endTime.getTime()) ||
      (data.location !== undefined && data.location !== workshop.room);

    // Map fields
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.location !== undefined) updateData.room = data.location;
    if (data.starts_at !== undefined) updateData.startTime = new Date(data.starts_at);
    if (data.ends_at !== undefined) updateData.endTime = new Date(data.ends_at);
    if (data.capacity !== undefined) updateData.capacity = data.capacity;

    if (criticalFieldsChanged) {
      updateData.needsNotification = true;
    }

    const updatedWorkshop = await prisma.workshop.update({
      where: { id },
      data: updateData,
      include: {
        pricing: true,
        _count: {
          select: { registrations: true },
        },
      },
    });

    const ipAddress = req.ip || req.headers.get('x-forwarded-for') || null;
    const userAgent = req.headers.get('user-agent') || null;

    // Async audit log with diffing
    auditLog('WORKSHOP_UPDATED',
      {
        workshop_id: id,
        changed_fields: Object.keys(updateData),
        old_value: workshop,
        new_value: updatedWorkshop
      },
      { userId: user.sub, resourceType: 'Workshop', resourceId: id, ipAddress, userAgent }
    );

    return NextResponse.json({
      ...updatedWorkshop,
      registration_count: updatedWorkshop._count.registrations,
      pricing: updatedWorkshop.pricing ? {
        base_price: updatedWorkshop.pricing.basePrice,
        currency: updatedWorkshop.pricing.currency,
        early_bird_price: updatedWorkshop.pricing.earlyBirdPrice,
        early_bird_deadline: updatedWorkshop.pricing.earlyBirdDeadline,
      } : null,
      _count: undefined,
    });

  } catch (error) {
    console.error('Workshop update error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
