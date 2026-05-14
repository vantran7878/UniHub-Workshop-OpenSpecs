import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/validations/prisma';
import { authenticateUser, requireRole } from '@/lib/auth/middleware';
import { CancelWorkshopSchema } from '@/lib/validations/workshop';
import { auditLog } from '@/lib/auth/audit';

export async function PATCH(
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
      return NextResponse.json({ message: 'Workshop is already cancelled' }, { status: 409 });
    }

    const body = await req.json();
    const validationResult = CancelWorkshopSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { message: 'Validation error', errors: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { reason } = validationResult.data;
    const registrationCount = workshop._count.registrations;

    // Transaction to update workshop and all its registrations
    const [updatedWorkshop] = await prisma.$transaction([
      prisma.workshop.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledReason: reason,
        },
      }),
      prisma.registration.updateMany({
        where: { workshopId: id },
        data: { status: 'cancelled' },
      }),
    ]);

    const ipAddress = req.ip || req.headers.get('x-forwarded-for') || null;
    const userAgent = req.headers.get('user-agent') || null;

    // Async audit log
    auditLog('WORKSHOP_CANCELLED', 
      { 
        workshop_id: id, 
        reason,
        registration_count: registrationCount 
      }, 
      { userId: user.sub, resourceType: 'Workshop', resourceId: id, ipAddress, userAgent }
    );

    // Trigger async jobs (notifications and refunds)
    // In a real system, these would be enqueued to a job processor like BullMQ or SQS.
    // For this implementation, we log the triggers as per design.
    console.log(`[JOB] Triggering cancellation notifications for workshop ${id} with reason: ${reason}`);
    
    if (workshop.isPaid && registrationCount > 0) {
      console.log(`[JOB] Triggering refund flow for workshop ${id} (${registrationCount} registrations)`);
    }

    return NextResponse.json({
      id: updatedWorkshop.id,
      status: updatedWorkshop.status,
      cancelled_at: updatedWorkshop.cancelledAt,
      reason: updatedWorkshop.cancelledReason,
    }, { status: 200 });

  } catch (error) {
    console.error('Workshop cancellation error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
