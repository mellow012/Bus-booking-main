'use client';
import { useLocale } from 'next-intl';
import { useRouter } from '../i18n/navigation';
import { usePathname } from 'next/navigation';
import { useTransition } from 'react';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    const next = locale === 'en' ? 'ny' : 'en';
    // Set cookie directly — no URL change
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=${60 * 60 * 24 * 365}`;
    startTransition(() => {
      router.refresh(); // re-runs server components with new locale from cookie
    });
  };

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200
                 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
    >
      {isPending ? (
        <span className="animate-spin">⟳</span>
      ) : locale === 'en' ? (
        <><span>🇲🇼</span><span className="hidden sm:inline">Chichewa</span></>
      ) : (
        <><span>🇬🇧</span><span className="hidden sm:inline">English</span></>
      )}
    </button>
  );
}
