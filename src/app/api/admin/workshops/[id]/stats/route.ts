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
        pricing: true,
      },
    });

    if (!workshop) {
      return NextResponse.json({ message: 'Workshop not found' }, { status: 404 });
    }

    // Basic counts
    const registrationCount = await prisma.registration.count({
      where: { workshopId: id, status: 'confirmed' },
    });

    const waitlistCount = await prisma.registration.count({
      where: { workshopId: id, status: 'pending' },
    });

    const capacityUsedPct = Number(((registrationCount / workshop.capacity) * 100).toFixed(1));

    let revenue = null;
    if (workshop.isPaid) {
      // Aggregate revenue from confirmed registrations
      const totalCollected = await prisma.payment.aggregate({
        where: { 
          registration: { 
            workshopId: id,
            status: 'confirmed'
          },
          status: 'completed'
        },
        _sum: {
          amount: true
        }
      });

      const pendingCount = await prisma.payment.count({
        where: {
          registration: {
            workshopId: id,
          },
          status: 'pending'
        }
      });

      revenue = {
        total_collected: totalCollected._sum.amount ? Number(totalCollected._sum.amount) : 0,
        currency: workshop.pricing?.currency || 'VND',
        pending_count: pendingCount,
      };
    }

    // Registrations over time (daily)
    // Fetch all confirmed registrations for the workshop to group in-memory
    const registrations = await prisma.registration.findMany({
      where: { workshopId: id, status: 'confirmed' },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const groupedData: Record<string, number> = {};
    registrations.forEach((reg) => {
      const date = reg.createdAt.toISOString().split('T')[0];
      groupedData[date] = (groupedData[date] || 0) + 1;
    });

    const registrationsOverTime = Object.entries(groupedData).map(([date, count]) => ({
      date,
      count,
    }));

    return NextResponse.json({
      workshop_id: id,
      capacity: workshop.capacity,
      registration_count: registrationCount,
      capacity_used_pct: capacityUsedPct,
      waitlist_count: waitlistCount,
      revenue,
      count_type: 'daily',
      registrations_over_time: registrationsOverTime,
    }, { status: 200 });

  } catch (error) {
    console.error('Workshop stats error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
