// components/NotificationProviderWrapper.tsx
'use client';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';

export function NotificationProviderWrapper({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth();
  return (
    <NotificationProvider userId={userProfile?.id}>
      {children}
    </NotificationProvider>
  );
}
