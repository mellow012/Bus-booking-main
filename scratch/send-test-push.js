require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Mock function mirroring sendNotificationToUser + sendWebPushToUser
async function sendNotification(userId, payload) {
  // 1. Create DB row
  const notification = await prisma.notification.create({
    data: {
      userId,
      title: payload.title,
      message: payload.body,
      type: payload.type || 'system',
      priority: payload.priority || 'medium',
      actionUrl: payload.clickAction,
      isRead: false,
    },
  });
  console.log(`DB Row Created: ID=${notification.id}`);

  // 2. Dispatch Web Push
  const vapidPublic  = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@tibhukebus.com';

  if (!vapidPublic || !vapidPrivate) {
    console.log('Skipping Web Push: VAPID keys not set');
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fcmTokens: true },
  });

  if (!user?.fcmTokens || !Array.isArray(user.fcmTokens)) {
    console.log('No subscriptions found for user');
    return;
  }

  const validSubs = user.fcmTokens.filter(
    (sub) => sub && typeof sub === 'object' && 'endpoint' in sub && 'keys' in sub
  );

  console.log(`Found ${validSubs.length} valid subscriptions for user`);

  if (validSubs.length === 0) return;

  const webpush = require('web-push');
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/tibhukebus_logo_transparent.png',
    badge: '/tibhukebus_logo_transparent.png',
    data: { url: payload.clickAction || '/' },
  });

  for (const sub of validSubs) {
    try {
      console.log(`Sending web push to endpoint: ${sub.endpoint.slice(0, 50)}...`);
      await webpush.sendNotification(sub, pushPayload);
      console.log('✅ Web Push Delivered successfully!');
    } catch (err) {
      console.log(`❌ Web Push failed: ${err.message} (Status: ${err.statusCode})`);
    }
  }
}

async function main() {
  // User: happieblessings3@gmail.com
  const userId = '936bd0ed-63ae-4f33-9f18-2736b401fd81';
  
  await sendNotification(userId, {
    title: 'Test Notification 🚌',
    body: 'This is an end-to-end verification of TibhukeBus Web Push system.',
    type: 'system',
    clickAction: '/bookings',
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
