'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function NavigationProgressBarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Complete progress bar when route/params change
  useEffect(() => {
    if (isNavigating) {
      setProgress(100);
      const timer = setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  // Intercept click on standard internal links to trigger top loading bar instantly
  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a') as HTMLAnchorElement | null;

      if (!anchor) return;

      const href = anchor.getAttribute('href');
      const targetAttr = anchor.getAttribute('target');

      // Only trigger for internal links that navigate within the app
      if (
        href &&
        href.startsWith('/') &&
        !href.startsWith('//') &&
        targetAttr !== '_blank' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.altKey
      ) {
        // Only trigger if destination is different from current full URL
        const currentFullUrl = window.location.pathname + window.location.search;
        if (href !== currentFullUrl) {
          setIsNavigating(true);
          setProgress(25);
        }
      }
    };

    // Intercept popstate (browser back/forward button clicks)
    const handlePopState = () => {
      setIsNavigating(true);
      setProgress(30);
    };

    // Intercept programmatic window.history.pushState & replaceState (used by Next.js router.push/replace)
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = function (...args) {
      const targetUrl = args[2];
      if (targetUrl) {
        const currentFullUrl = window.location.pathname + window.location.search;
        const targetStr = String(targetUrl);
        if (targetStr !== currentFullUrl) {
          setTimeout(() => {
            setIsNavigating(true);
            setProgress(25);
          }, 0);
        }
      }
      return originalPushState(...args);
    };

    window.history.replaceState = function (...args) {
      const targetUrl = args[2];
      if (targetUrl) {
        const currentFullUrl = window.location.pathname + window.location.search;
        const targetStr = String(targetUrl);
        if (targetStr !== currentFullUrl) {
          setTimeout(() => {
            setIsNavigating(true);
            setProgress(25);
          }, 0);
        }
      }
      return originalReplaceState(...args);
    };

    document.addEventListener('click', handleAnchorClick, true);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('click', handleAnchorClick, true);
      window.removeEventListener('popstate', handlePopState);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  // Safety fallback: Automatically complete and hide progress bar after 5 seconds
  // in case Next.js navigation is cancelled, aborted, or does not trigger pathname change.
  useEffect(() => {
    if (!isNavigating) return;

    const safetyTimer = setTimeout(() => {
      setProgress(100);
      const finishTimer = setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
      }, 300);
      return () => clearTimeout(finishTimer);
    }, 5000);

    return () => clearTimeout(safetyTimer);
  }, [isNavigating]);

  // Simulate smooth progress increment while waiting for route change
  useEffect(() => {
    if (!isNavigating) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + Math.floor(Math.random() * 10 + 5);
      });
    }, 150);

    return () => clearInterval(interval);
  }, [isNavigating]);

  if (!isNavigating && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none">
      <div
        className="h-1 bg-gradient-to-r from-brand-600 via-amber-400 to-emerald-500 shadow-md shadow-brand-500/50 transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition: progress === 100 ? 'opacity 0.3s ease-out, width 0.1s linear' : 'width 0.2s ease-out',
        }}
      />
    </div>
  );
}

export function NavigationProgressBar() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressBarContent />
    </Suspense>
  );
}
