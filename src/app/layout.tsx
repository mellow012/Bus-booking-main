import type { Metadata } from "next";
import { Inter } from "next/font/google";
import '@/app/globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ToastContainer } from "@/components/ToastContainer";
import { EmailVerificationBannerLayout } from "@/components/EmailVerificationBannerLayout";
import { FCMInitializer } from "@/components/FCMInitializer";
import AuthListener from "@/components/AuthListener";
import { NotificationProviderWrapper } from "@/components/NotificationProviderWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TibhukeBus - Multi-Company Bus Booking Platform",
  description: "Book and pay for bus tickets from multiple companies.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale   = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          {/* AuthProvider MUST be outermost — everything that calls useAuth()
              must be a descendant, including NotificationProviderWrapper */}
          <AuthProvider>
            <NotificationProviderWrapper>
              <ToastProvider>
                <div className="min-h-screen flex flex-col">
                  <Header />
                  <main className="flex-grow py-12">
                    <EmailVerificationBannerLayout />
                    {children}
                  </main>
                  <Footer />
                </div>
                <FCMInitializer />
                <ToastContainer />
              </ToastProvider>
            </NotificationProviderWrapper>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}