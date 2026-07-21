import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { authRateLimiter, getClientIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { success, reset } = await authRateLimiter.limit(ip);
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return NextResponse.json(
        { success: false, error: 'Too many promo validation attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter > 0 ? retryAfter : 60) } }
      );
    }
    const body = await req.json();
    const { code, amount } = body;

    if (!code) {
      return NextResponse.json({ success: false, error: 'Promo code is required' }, { status: 400 });
    }

    const now = new Date();
    const promotion = await prisma.promotion.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!promotion) {
      return NextResponse.json({ success: false, error: 'Invalid promo code' }, { status: 404 });
    }

    if (!promotion.isActive) {
      return NextResponse.json({ success: false, error: 'This promo code is no longer active' }, { status: 400 });
    }

    if (now < promotion.startDate) {
      return NextResponse.json({ success: false, error: 'This promotion has not started yet' }, { status: 400 });
    }

    if (now > promotion.endDate) {
      return NextResponse.json({ success: false, error: 'This promotion has expired' }, { status: 400 });
    }

    if (amount && promotion.minPurchase && amount < promotion.minPurchase) {
      return NextResponse.json({ 
        success: false, 
        error: `Minimum purchase of MWK ${promotion.minPurchase.toLocaleString()} required` 
      }, { status: 400 });
    }

    let discount = 0;
    if (promotion.discountType === 'percentage') {
      discount = (amount * promotion.discountValue) / 100;
      if (promotion.maxDiscount && discount > promotion.maxDiscount) {
        discount = promotion.maxDiscount;
      }
    } else {
      discount = promotion.discountValue;
    }

    // Ensure discount doesn't exceed amount
    if (amount && discount > amount) {
      discount = amount;
    }

    return NextResponse.json({
      success: true,
      data: {
        code: promotion.code,
        discount,
        discountType: promotion.discountType,
        discountValue: promotion.discountValue,
        title: promotion.title
      }
    });

  } catch (error: any) {
    await logger.logError('booking', 'Failed to validate promotion', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
