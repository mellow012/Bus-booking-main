'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function NavigationProgressBarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const activeUrlRef = useRef<string>('');
  const finishTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize current URL reference on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      activeUrlRef.current = window.location.pathname + window.location.search;
    }
  }, []);

  // Clear running timers
  const clearTimers = () => {
    if (finishTimeoutRef.current) {
      clearTimeout(finishTimeoutRef.current);
      finishTimeoutRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  // Start progress bar
  const startProgress = (targetUrl?: string) => {
    clearTimers();
    setIsVisible(true);
    setIsNavigating(true);
    setProgress((prev) => (prev > 0 && prev < 90 ? prev : 25));

    // Smooth progressive trickle while waiting for new page DOM to mount
    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) {
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          return 92;
        }
        // Decelerating progress curve as it gets higher
        const delta = Math.max(1, Math.floor((92 - prev) * 0.15));
        return Math.min(92, prev + delta);
      });
    }, 100);
  };

  // Complete progress bar in sync with browser DOM paint frame
  const completeProgress = () => {
    clearTimers();
    setProgress(100);

    // Wait 200ms at 100% for smooth visual completion, then fade out
    finishTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
      finishTimeoutRef.current = setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
      }, 350);
    }, 200);
  };

  // Trigger completion when pathname or searchParams change
  useEffect(() => {
    const currentFullUrl = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    
    // Only complete if route actually changed or loader was active
    if (isNavigating || currentFullUrl !== activeUrlRef.current) {
      activeUrlRef.current = currentFullUrl;

      // Use requestAnimationFrame to ensure React has committed the new page frame to the DOM
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          completeProgress();
        });
      });
    }
  }, [pathname, searchParams]);

  // Intercept click on internal links, history pushState/replaceState, and popstate
  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a') as HTMLAnchorElement | null;

      if (!anchor) return;

      const href = anchor.getAttribute('href');
      const targetAttr = anchor.getAttribute('target');

      // Ignore external links, mailto, tel, downloads, or new tab clicks
      if (
        !href ||
        href.startsWith('http') ||
        href.startsWith('//') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('#') ||
        targetAttr === '_blank' ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const currentFullUrl = window.location.pathname + window.location.search;
      if (href !== currentFullUrl) {
        startProgress(href);
      }
    };

    // Intercept browser back/forward buttons
    const handlePopState = () => {
      startProgress(window.location.pathname);
    };

    // Intercept custom navigation events
    const handleCustomNavStart = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      startProgress(detail?.url);
    };

    // Intercept window.history.pushState and replaceState (used by Next.js router.push / replace)
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = function (...args) {
      const targetUrl = args[2];
      if (targetUrl) {
        const currentFullUrl = window.location.pathname + window.location.search;
        const targetStr = String(targetUrl);
        if (targetStr !== currentFullUrl) {
          // Defer out of the synchronous pushState call stack.
          // Next.js calls pushState inside useInsertionEffect, and React 18
          // forbids setState from being called synchronously in that context.
          setTimeout(() => startProgress(targetStr), 0);
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
          setTimeout(() => startProgress(targetStr), 0);
        }
      }
      return originalReplaceState(...args);
    };

    document.addEventListener('click', handleAnchorClick, true);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('next-navigation-start', handleCustomNavStart);

    return () => {
      document.removeEventListener('click', handleAnchorClick, true);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('next-navigation-start', handleCustomNavStart);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      clearTimers();
    };
  }, []);

  // Safety fallback: Automatically complete and hide progress bar after 6 seconds
  // in case Next.js navigation is cancelled, aborted, or fails to trigger route change.
  useEffect(() => {
    if (!isNavigating) return;

    const safetyTimer = setTimeout(() => {
      completeProgress();
    }, 6000);

    return () => clearTimeout(safetyTimer);
  }, [isNavigating]);

  if (!isNavigating && !isVisible && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[999999] pointer-events-none transition-opacity duration-300"
      style={{ opacity: isVisible ? 1 : 0 }}
      aria-hidden="true"
    >
      {/* Glow highlight bar */}
      <div
        className="h-1 bg-gradient-to-r from-brand-600 via-amber-400 to-emerald-500 shadow-md shadow-brand-500/50"
        style={{
          width: `${progress}%`,
          transition: progress === 100 ? 'width 0.2s ease-out' : 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
      {/* Leading edge light dot effect */}
      {progress > 0 && progress < 100 && (
        <div
          className="absolute top-0 h-1 w-6 bg-white/80 blur-[1px] shadow-[0_0_8px_#3b82f6]"
          style={{
            left: `calc(${progress}% - 12px)`,
            transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      )}
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
