import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { Bus, Route, Company } from '@/types';

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const params = await props.params;
  const scheduleId = params.id;

  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        company: true,
        route: true,
        bus: true,
      }
    });

    if (!schedule || !schedule.company || !schedule.route) {
      return {
        title: 'Schedule Not Found | TibhukeBus',
        description: 'The requested bus schedule could not be found.'
      };
    }

    const title = `${schedule.route.origin} to ${schedule.route.destination} | ${schedule.company.name}`;
    const description = `Book your trip from ${schedule.route.origin} to ${schedule.route.destination} on ${new Date(schedule.departureDateTime).toLocaleDateString()} with ${schedule.company.name}. ${schedule.availableSeats} seats available.`;

    // Assuming the app is deployed at process.env.NEXT_PUBLIC_APP_URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tibhukebus.com';
    const ogImageUrl = `${appUrl}/api/og?route=${encodeURIComponent(`${schedule.route.origin} to ${schedule.route.destination}`)}&date=${encodeURIComponent(new Date(schedule.departureDateTime).toISOString())}&fare=${schedule.price}&company=${encodeURIComponent(schedule.company.name)}&busType=${encodeURIComponent(schedule.bus?.busType || 'Bus')}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        images: [{
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImageUrl],
      },
    };
  } catch (err) {
    return {
      title: 'Book Schedule | TibhukeBus',
    };
  }
}

export default function BookScheduleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
