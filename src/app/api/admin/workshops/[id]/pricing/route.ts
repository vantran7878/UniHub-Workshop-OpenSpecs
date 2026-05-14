import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/validations/prisma';
import { authenticateUser, requireRole } from '@/lib/auth/middleware';
import { PricingSetupSchema } from '@/lib/validations/workshop';
import { auditLog } from '@/lib/auth/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = authenticateUser(req);
    if (!user || !requireRole(user, ['admin'])) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;

    // Fetch workshop and existing pricing/registrations
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

    if (!workshop.isPaid) {
      return NextResponse.json({ message: 'Cannot set pricing for free workshops' }, { status: 400 });
    }

    if (workshop.status === 'cancelled') {
      return NextResponse.json({ message: 'Cannot update pricing for cancelled workshops' }, { status: 409 });
    }

    const body = await req.json();
    const validationResult = PricingSetupSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { message: 'Validation error', errors: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { base_price, currency, early_bird_price, early_bird_deadline } = validationResult.data;

    // Cross-field validation: deadline before workshop starts
    if (early_bird_deadline && new Date(early_bird_deadline) >= workshop.startTime) {
      return NextResponse.json(
        { message: 'Early bird deadline must be before workshop start time' },
        { status: 400 }
      );
    }

    const oldPricing = workshop.pricing;

    // Upsert pricing
    const pricing = await prisma.workshopPricing.upsert({
      where: { workshopId: id },
      create: {
        workshopId: id,
        basePrice: base_price,
        currency,
        earlyBirdPrice: early_bird_price,
        earlyBirdDeadline: early_bird_deadline ? new Date(early_bird_deadline) : null,
      },
      update: {
        basePrice: base_price,
        currency,
        earlyBirdPrice: early_bird_price,
        earlyBirdDeadline: early_bird_deadline ? new Date(early_bird_deadline) : null,
      },
    });

    // Check for registration warning
    const registrationCount = workshop._count.registrations;
    let warning: string | undefined;
    if (registrationCount > 0) {
      warning = `Workshop đã có ${registrationCount} registrations. Thay đổi giá sẽ không ảnh hưởng đến các đăng ký đã thanh toán.`;
    }

    const ipAddress = req.ip || req.headers.get('x-forwarded-for') || null;
    const userAgent = req.headers.get('user-agent') || null;

    // Async audit log
    auditLog('PRICING_UPDATED', 
      { 
        workshop_id: id, 
        old_value: oldPricing, 
        new_value: pricing 
      }, 
      { userId: user.sub, resourceType: 'Workshop', resourceId: id, ipAddress, userAgent }
    );

    return NextResponse.json({
      workshop_id: pricing.workshopId,
      base_price: pricing.basePrice,
      currency: pricing.currency,
      early_bird_price: pricing.earlyBirdPrice,
      early_bird_deadline: pricing.earlyBirdDeadline,
      updated_at: pricing.updatedAt,
      warning,
    }, { status: 200 });

  } catch (error) {
    console.error('Pricing setup error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
