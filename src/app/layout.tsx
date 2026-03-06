import type { Metadata } from "next";
import { Inter } from "next/font/google";
import '@/app/globals.css';
import { NextIntlClientProvider } from 'next-intl';  // ← add
import { getLocale, getMessages } from 'next-intl/server';  // ← add
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ToastProvider } from "@/contexts/ToastContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ToastContainer } from "@/components/ToastContainer";
import { EmailVerificationBannerLayout } from "@/components/EmailVerificationBannerLayout";
import { FCMInitializer } from "@/components/FCMInitializer";
import AuthListener from "@/components/AuthListener";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TibhukeBus - Multi-Company Bus Booking Platform",
  description: "Book and pay for bus tickets from multiple companies.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();      // ← reads from NEXT_LOCALE cookie
  const messages = await getMessages();  // ← loads en.json or ny.json

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>  {/* ← wrap everything */}
          <NotificationProvider>
            <AuthProvider>
              <ToastProvider>
                <div className="min-h-screen flex flex-col">
                  <Header />
                  <main className="flex-grow py-12">
                    <EmailVerificationBannerLayout />
                    <AuthListener />
                    {children}
                  </main>
                  <Footer />
                </div>
                <FCMInitializer />
                <ToastContainer />
              </ToastProvider>
            </AuthProvider>
          </NotificationProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}