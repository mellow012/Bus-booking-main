import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.tibhukebus.com';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/company/', '/profile/', '/bookings/', '/book/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
