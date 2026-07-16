import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Find ALL rows matching this email
  const byEmail = await prisma.user.findMany({
    where: { email: 'booknpaymw012@gmail.com' },
    select: { id: true, uid: true, firstName: true, lastName: true, phone: true, setupCompleted: true, createdAt: true, updatedAt: true }
  });

  // Also check by the two IDs we saw
  const byId1 = await prisma.user.findUnique({
    where: { id: 'ecec47dd-f24a-4f4e-9636-0350d9d6d1c5' },
    select: { id: true, uid: true, email: true, setupCompleted: true }
  });

  const byUid = await prisma.user.findFirst({
    where: { uid: 'a9a43c26-bcc7-4349-99fd-13251f0fb35d' },
    select: { id: true, uid: true, email: true, setupCompleted: true }
  });

  return NextResponse.json({ byEmail, byId1, byUid }, { status: 200 });
}
