import type { Metadata, Viewport } from "next";
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
import { NotificationProviderWrapper } from "@/components/NotificationProviderWrapper";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export const metadata: Metadata = {
  title: {
    template: "%s | TibhukeBus",
    default: "TibhukeBus - Malawi's #1 Bus Booking Platform",
  },
  description: "Find, compare and book bus seats instantly across Malawi. Secure payments via Airtel Money, Mpamba, and Visa. Real-time availability for all major routes.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TibhukeBus",
  },
  icons: {
    icon: "/tibhukebus_logo_transparent.png",
    shortcut: "/tibhukebus_logo_transparent.png",
    apple: "/tibhukebus_logo_transparent.png",
  },
  openGraph: {
    type: "website",
    locale: "en_MW",
    url: "https://tibhukebus.com",
    siteName: "TibhukeBus",
    title: "TibhukeBus - Travel Anywhere in Malawi",
    description: "Book and pay for bus tickets instantly from multiple companies. The fastest way to travel across Malawi.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TibhukeBus - Bus Booking Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TibhukeBus - Travel Anywhere in Malawi",
    description: "Book and pay for bus tickets instantly. Secure payments and real-time availability.",
    images: ["/og-image.png"],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  }
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
                <ToastContainer />
              </ToastProvider>
            </NotificationProviderWrapper>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
