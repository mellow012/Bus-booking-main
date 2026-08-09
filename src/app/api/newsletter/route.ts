import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendNewsletterWelcomeEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if already subscribed
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      if (!existing.isActive) {
        // Re-activate if they were inactive
        await prisma.newsletterSubscriber.update({
          where: { email: cleanEmail },
          data: { isActive: true },
        });
        
        // Resend welcome email
        await sendNewsletterWelcomeEmail(cleanEmail);
      }
      
      return NextResponse.json({
        success: true,
        message: 'You are already subscribed to our newsletter!',
      });
    }

    // Save subscriber to database
    await prisma.newsletterSubscriber.create({
      data: { email: cleanEmail },
    });

    // Send Resend welcome email (async background, won't block response)
    sendNewsletterWelcomeEmail(cleanEmail).catch((err) => {
      logger.logError('booking', 'Newsletter email sending failed', err);
    });

    return NextResponse.json({
      success: true,
      message: 'Subscribed successfully!',
    });
  } catch (error: any) {
    await logger.logError('booking', 'Failed to subscribe to newsletter', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred. Please try again later.' },
      { status: 500 }
    );
  }
}
