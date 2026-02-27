import type { Metadata } from "next";
import { Inter } from "next/font/google";
import '@/app/globals.css';
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
  description: "Book and pay for bus tickets from multiple companies. Find the best routes, compare prices, book & pay for your journey with ease.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <NotificationProvider>
          <AuthProvider>
            <ToastProvider>
              <EmailVerificationBannerLayout />
              <FCMInitializer />
              <div className="min-h-screen flex flex-col">
                <Header />
                <main className="flex-grow py-12">
                  <AuthListener />
                  {children}
                </main>
                <Footer />
              </div>
              {/* ✅ Toast Container - displays at bottom-right */}
              <ToastContainer />
            </ToastProvider>
          </AuthProvider>
        </NotificationProvider>
      </body>
    </html>
  );
}