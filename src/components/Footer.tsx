'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BusIcon, Phone, Mail, MapPin, Clock, Shield,
  Facebook, Instagram, Linkedin, MessageCircle,
  ArrowRight, Heart, Award, CheckCircle, ChevronRight
} from 'lucide-react';
import Image from 'next/image';

const XIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const pathname = usePathname() || '';

  const isAdminPage =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/company/admin') ||
    pathname.startsWith('/company/operator') ||
    pathname.startsWith('/company/conductor');

  if (isAdminPage) return null;

  const quickLinks = [
    { href: '/', label: 'Home', ariaLabel: 'Go to homepage' },
    { href: '/search', label: 'Search Buses', ariaLabel: 'Search bus schedules' },
    { href: '/schedules', label: 'Schedules', ariaLabel: 'View bus schedules' },
    { href: '/bookings', label: 'My Bookings', ariaLabel: 'View your bookings' },
    { href: '/routes', label: 'Popular Routes', ariaLabel: 'Explore popular routes' },
    { href: '/#promotions-section', label: 'Special Offers', ariaLabel: 'Check special offers' }
  ];

  const support = [
    { href: '/help', label: 'Help Center', ariaLabel: 'Get help and support' },
    { href: '/contact', label: 'Contact Us', ariaLabel: 'Contact customer service' },
    { href: '/faq', label: 'FAQ', ariaLabel: 'Frequently asked questions' },
    { href: '/booking-guide', label: 'Booking Guide', ariaLabel: 'Learn how to book' },
    { href: '/cancellation', label: 'Cancellation', ariaLabel: 'Cancellation policy' },
    { href: '/refund', label: 'Refunds', ariaLabel: 'Refund information' }
  ];

  const legal = [
    { href: '/terms', label: 'Terms of Service', ariaLabel: 'View terms of service' },
    { href: '/privacy', label: 'Privacy Policy', ariaLabel: 'View privacy policy' },
    { href: '/refund-policy', label: 'Refund Policy', ariaLabel: 'View refund policy' },
    { href: '/safety', label: 'Safety Guidelines', ariaLabel: 'View safety guidelines' }
  ];

  const features = [
    { icon: Shield, title: 'Secure Payments', desc: 'Encrypted & protected checkout' },
    { icon: Clock, title: '24/7 Support', desc: 'Round-the-clock customer assistance' },
    { icon: CheckCircle, title: 'Instant Booking', desc: 'Real-time e-ticket confirmation' },
    { icon: Award, title: 'Trusted Platform', desc: 'Verified bus operator partners' }
  ];

  return (
    <footer
      className="relative bg-brand-800 text-gray-300 overflow-hidden"
      role="contentinfo"
      aria-label="Site footer with company information, links, and subscription"
    >
      {/* Gradient Background — brand-800 → brand-900 | white text = 12:1 (AAA) ✓ */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-800 via-brand-900 to-brand-900"></div>
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-400/40 to-transparent"></div>

      {/* Background Pattern — decorative blobs, low opacity, no contrast concern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-72 h-72 bg-brand-400 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-coral-400 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto p-container">
        {/* Features Section */}
        <div className="py-20 border-b border-gray-800/50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 hover:border-brand-400/30 transition-all duration-300 hover:scale-105"
                role="region"
                aria-label={`${feature.title} feature`}
              >
                <div className="flex items-start space-x-4">
                  {/* brand-700 → brand-600 | white icon = 7.8:1 (AAA) ✓ */}
                  <div className="p-3 rounded-xl bg-gradient-to-r from-brand-700 to-brand-600 group-hover:from-brand-600 group-hover:to-brand-700 transition-all duration-300">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1 group-hover:text-brand-300 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-gray-400 text-sm">{feature.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Footer Content */}
        <div className="py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Company Info */}
            <div className="lg:col-span-5">
              <Link
                href="/"
                className="inline-flex items-center space-x-3 group mb-6"
                aria-label="Go to TibhukeBus homepage"
              >
                <div className="relative">
                  <div className="w-20 h-20 flex items-center justify-center transition-all duration-300 group-hover:scale-105">
                    <img
                      src="/tibhukebus_logo_footer.png"
                      alt="TibhukeBus Logo"
                      className="object-contain w-auto h-auto drop-shadow-md"
                      style={{ height: 'auto' }}
                    />
                  </div>
                </div>
                <div>
                  <span className="text-2xl font-bold bg-gradient-to-r from-white to-brand-300 bg-clip-text text-transparent group-hover:from-brand-300 group-hover:to-white transition-all duration-300">
                    TibhukeBus
                  </span>
                  <div className="text-xs text-brand-400 -mt-1">Smart Travel Platform</div>
                </div>
              </Link>

              <p className="text-gray-300 mb-8 max-w-md leading-relaxed">
                Your trusted companion for seamless bus travel across the country. We connect you with
                reliable bus operators, offer transparent pricing, and ensure your journey is comfortable
                and hassle-free.
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-center space-x-3 text-gray-300 hover:text-brand-100 transition-colors group">
                  <div className="p-2 rounded-lg bg-brand-400/20 group-hover:bg-brand-400/30 transition-colors">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">24/7 Support</div>
                    <div className="font-medium">+265 99 145 74 95</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 text-gray-300 hover:text-brand-100 transition-colors group">
                  <div className="p-2 rounded-lg bg-brand-400/20 group-hover:bg-brand-400/30 transition-colors">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Email Support</div>
                    <div className="font-medium">support@tibhukebus.com</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 text-gray-300 hover:text-brand-100 transition-colors group">
                  <div className="p-2 rounded-lg bg-brand-400/20 group-hover:bg-brand-400/30 transition-colors">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Headquarters</div>
                    <div className="font-medium">Mzuzu, Malawi</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-white font-semibold mb-4">Follow Us</div>
                <div className="flex space-x-3">
                  {[
                    { icon: Facebook, href: 'https://facebook.com/tibhukebus', color: 'hover:bg-brand-600', ariaLabel: 'Follow TibhukeBus on Facebook (@tibhukebus)' },
                    { icon: XIcon, href: 'https://x.com/tibhukebus', color: 'hover:bg-black hover:text-white', ariaLabel: 'Follow TibhukeBus on X (@tibhukebus)' },
                    { icon: Instagram, href: '#', color: 'hover:bg-coral-600', ariaLabel: 'Instagram page' },
                    { icon: Linkedin, href: '#', color: 'hover:bg-brand-700', ariaLabel: 'LinkedIn page' }
                  ].map((social, index) => (
                    <a
                      key={index}
                      href={social.href}
                      className={`p-3 rounded-xl bg-white/10 text-gray-300 hover:text-white ${social.color} transition-all duration-300 hover:scale-110 hover:shadow-lg backdrop-blur-sm`}
                      aria-label={social.ariaLabel}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <social.icon className="w-5 h-5" />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div>
                <h3 className="text-white font-bold text-lg mb-6 relative">
                  Quick Links
                  <div className="absolute -bottom-2 left-0 w-8 h-0.5 bg-gradient-to-r from-brand-500 to-coral-500 rounded-full"></div>
                </h3>
                <ul className="space-y-3">
                  {quickLinks.map((link, index) => (
                    <li key={index}>
                      <Link
                        href={link.href}
                        className="flex items-center space-x-2 text-gray-300 hover:text-brand-100 transition-all duration-200 group py-1"
                        aria-label={link.ariaLabel}
                      >
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transform translate-x-1 group-hover:translate-x-0 transition-all duration-200" />
                        <span className="group-hover:translate-x-1 transition-transform duration-200">{link.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-white font-bold text-lg mb-6 relative">
                  Support
                  <div className="absolute -bottom-2 left-0 w-8 h-0.5 bg-gradient-to-r from-brand-500 to-coral-500 rounded-full"></div>
                </h3>
                <ul className="space-y-3">
                  {support.map((link, index) => (
                    <li key={index}>
                      <Link
                        href={link.href}
                        className="flex items-center space-x-2 text-gray-300 hover:text-brand-100 transition-all duration-200 group py-1"
                        aria-label={link.ariaLabel}
                      >
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transform translate-x-1 group-hover:translate-x-0 transition-all duration-200" />
                        <span className="group-hover:translate-x-1 transition-transform duration-200">{link.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-white font-bold text-lg mb-6 relative">
                  Legal
                  <div className="absolute -bottom-2 left-0 w-8 h-0.5 bg-gradient-to-r from-brand-500 to-coral-500 rounded-full"></div>
                </h3>
                <ul className="space-y-3 mb-8">
                  {legal.map((link, index) => (
                    <li key={index}>
                      <Link
                        href={link.href}
                        className="flex items-center space-x-2 text-gray-300 hover:text-brand-100 transition-all duration-200 group py-1"
                        aria-label={link.ariaLabel}
                      >
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transform translate-x-1 group-hover:translate-x-0 transition-all duration-200" />
                        <span className="group-hover:translate-x-1 transition-transform duration-200">{link.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>

                {/* Payment Methods */}
                <div>
                  <h4 className="text-gray-300 font-semibold mb-3">We Accept</h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-white/10 rounded-lg text-xs text-gray-200 backdrop-blur-sm border border-white/10 hover:bg-white/15 transition-colors">
                      <img src="/airtel-money-logo.png" alt="Airtel Money" className="w-5 h-5 object-contain rounded-sm" />
                      <span>Airtel Money</span>
                    </div>
                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-white/10 rounded-lg text-xs text-gray-200 backdrop-blur-sm border border-white/10 hover:bg-white/15 transition-colors">
                      <img src="/mpamba%20logo.jpg" alt="TNM Mpamba" className="w-5 h-5 object-contain rounded-sm" />
                      <span>TNM Mpamba</span>
                    </div>
                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-white/10 rounded-lg text-xs text-gray-200 backdrop-blur-sm border border-white/10 hover:bg-white/15 transition-colors">
                      <img src="/Visa.svg" alt="Visa" className="w-5 h-5 object-contain" />
                      <span>Visa</span>
                    </div>
                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-white/10 rounded-lg text-xs text-gray-200 backdrop-blur-sm border border-white/10 hover:bg-white/15 transition-colors">
                      <img src="/PayChangu%20Logo.png" alt="PayChangu" className="h-4 w-auto object-contain" />
                      <span>PayChangu</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* Newsletter Section */}
        <div className="py-12 border-t border-gray-800/50">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="lg:max-w-md">
              <h3 className="text-white font-bold text-xl mb-2">Stay Updated</h3>
              <p className="text-gray-300">Get the latest offers, routes, and travel tips delivered to your inbox.</p>
            </div>
            <form className="flex flex-col sm:flex-row gap-4" onSubmit={(e) => e.preventDefault()}>
              <div className="relative w-full sm:w-80">
                <input
                  type="email"
                  placeholder="Enter your email address"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent backdrop-blur-sm"
                  aria-label="Email address for newsletter subscription"
                  required
                />
              </div>
              {/* Subscribe CTA — coral-500 | white bold text = 3.4:1 (large-text AA ✓) */}
              <button
                type="submit"
                className="px-8 py-3 bg-coral-500 hover:bg-coral-600 text-white rounded-xl transition-all duration-300 font-semibold flex items-center justify-center space-x-2 hover:shadow-lg hover:shadow-coral-500/25 hover:scale-105"
                aria-label="Subscribe to newsletter"
              >
                <span>Subscribe</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="py-8 border-t border-gray-800/50">
          <div className="flex items-center justify-center text-center">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-gray-300 text-sm text-center">
              <span>© {currentYear} TibhukeBus. All Rights Reserved.</span>
              <span className="hidden sm:inline text-gray-600">|</span>
              <div className="flex items-center space-x-1">
                <span>Made with</span>
                <Heart className="w-4 h-4 text-red-500 animate-pulse" />
                <span>for travelers everywhere.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
