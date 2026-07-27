import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  let locale = 'en';
  try {
    const cookieStore = await cookies();
    const val = cookieStore.get('NEXT_LOCALE')?.value;
    if (val) locale = val;
  } catch {
    // Dynamic server context not available during static page prerendering
  }

  // Validate — fall back to English if cookie has an unexpected value
  const validLocale = ['en', 'ny'].includes(locale) ? locale : 'en';

  return {
    locale: validLocale,
    messages: (await import(`../messages/${validLocale}.json`)).default,
  };
});