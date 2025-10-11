import type { Metadata } from "next";
import { Inter } from "next/font/google";
import '@/app/globals.css';
import { AuthProvider } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { NotificationProvider } from "@/contexts/NotificationContext";
import AuthListener from "@/components/AuthListener"; // Assuming this file exists or will be created

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BooknPay - Multi-Company Bus Booking Platform",
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
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow py-12">
        <AuthListener />
        {children}
      </main>
      <Footer />
    </div>
  </AuthProvider>
</NotificationProvider>
      </body>
    </html>
  );
}