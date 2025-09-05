'use client';

import React from 'react';
import Link from 'next/link';
import {
  BusIcon,
  Phone,
  Mail,
  MapPin,
  Clock,
  Shield,
  CreditCard,
  Globe,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  MessageCircle,
  ArrowRight,
  Heart,
  Zap,
  Users,
  Award,
  CheckCircle,
  ChevronRight
} from 'lucide-react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { href: '/', label: 'Home', ariaLabel: 'Go to homepage' },
    { href: '/search', label: 'Search Buses', ariaLabel: 'Search bus schedules' },
    { href: '/schedules', label: 'Schedules', ariaLabel: 'View bus schedules' },
    { href: '/bookings', label: 'My Bookings', ariaLabel: 'View your bookings' },
    { href: '/routes', label: 'Popular Routes', ariaLabel: 'Explore popular routes' },
    { href: '/offers', label: 'Special Offers', ariaLabel: 'Check special offers' }
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
    { icon: Shield, title: 'Secure Payments', desc: '256-bit SSL encryption' },
    { icon: Clock, title: '24/7 Support', desc: 'Round-the-clock assistance' },
    { icon: CheckCircle, title: 'Instant Booking', desc: 'Confirm in seconds' },
    { icon: Award, title: 'Trusted Platform', desc: '10M+ happy travelers' }
  ];

  return (
    <footer
      className="relative bg-gray-900 text-gray-300 overflow-hidden"
      role="contentinfo"
      aria-label="Site footer with company information, links, and subscription"
    >
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-900/20 to-indigo-900/30"></div>
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent"></div>
      
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-500 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Features Section */}
        <div className="py-16 border-b border-gray-800/50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 hover:border-blue-400/30 transition-all duration-300 hover:scale-105"
                role="region"
                aria-label={`${feature.title} feature`}
              >
                <div className="flex items-start space-x-4">
                  <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 group-hover:from-blue-500 group-hover:to-indigo-500 transition-all duration-300">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1 group-hover:text-blue-300 transition-colors">
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
            {/* Company Info - Enhanced */}
            <div className="lg:col-span-5">
              <Link
                href="/"
                className="inline-flex items-center space-x-3 group mb-6"
                aria-label="Go to BooknPay homepage"
              >
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl group-hover:shadow-blue-500/25 transition-all duration-300 group-hover:scale-105">
                    <BusIcon className="w-6 h-6 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-gray-900 animate-pulse"></div>
                </div>
                <div>
                  <span className="text-2xl font-bold bg-gradient-to-r from-white to-blue-300 bg-clip-text text-transparent group-hover:from-blue-300 group-hover:to-white transition-all duration-300">
                    BooknPay
                  </span>
                  <div className="text-xs text-blue-400 -mt-1">Smart Travel Platform</div>
                </div>
              </Link>

              <p className="text-gray-300 mb-8 max-w-md leading-relaxed">
                Your trusted companion for seamless bus travel across the country. 
                We connect you with reliable bus operators, offer transparent pricing, 
                and ensure your journey is comfortable and hassle-free.
              </p>

              {/* Contact Info */}
              <div className="space-y-4 mb-8">
                <div className="flex items-center space-x-3 text-gray-300 hover:text-blue-300 transition-colors group">
                  <div className="p-2 rounded-lg bg-blue-600/20 group-hover:bg-blue-600/30 transition-colors">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">24/7 Support</div>
                    <div className="font-medium">+265 99 145 74 95</div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 text-gray-300 hover:text-blue-300 transition-colors group">
                  <div className="p-2 rounded-lg bg-blue-600/20 group-hover:bg-blue-600/30 transition-colors">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Email Support</div>
                    <div className="font-medium">support@booknpay.com</div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-gray-300 hover:text-blue-300 transition-colors group">
                  <div className="p-2 rounded-lg bg-blue-600/20 group-hover:bg-blue-600/30 transition-colors">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Headquarters</div>
                    <div className="font-medium">Mzuzu, Malawi</div>
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div>
                <div className="text-white font-semibold mb-4">Follow Us</div>
                <div className="flex space-x-3">
                  {[
                    { icon: Facebook, href: '#', color: 'hover:bg-blue-600', ariaLabel: 'Facebook page' },
                    { icon: Twitter, href: '#', color: 'hover:bg-sky-500', ariaLabel: 'Twitter page' },
                    { icon: Instagram, href: '#', color: 'hover:bg-pink-600', ariaLabel: 'Instagram page' },
                    { icon: Linkedin, href: '#', color: 'hover:bg-blue-700', ariaLabel: 'LinkedIn page' }
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

            {/* Links Sections */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-8">
              {/* Quick Links */}
              <div>
                <h3 className="text-white font-bold text-lg mb-6 relative">
                  Quick Links
                  <div className="absolute -bottom-2 left-0 w-8 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"></div>
                </h3>
                <ul className="space-y-3">
                  {quickLinks.map((link, index) => (
                    <li key={index}>
                      <Link
                        href={link.href}
                        className="flex items-center space-x-2 text-gray-300 hover:text-blue-300 transition-all duration-200 group py-1"
                        aria-label={link.ariaLabel}
                      >
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transform translate-x-1 group-hover:translate-x-0 transition-all duration-200" />
                        <span className="group-hover:translate-x-1 transition-transform duration-200">{link.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Support */}
              <div>
                <h3 className="text-white font-bold text-lg mb-6 relative">
                  Support
                  <div className="absolute -bottom-2 left-0 w-8 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"></div>
                </h3>
                <ul className="space-y-3">
                  {support.map((link, index) => (
                    <li key={index}>
                      <Link
                        href={link.href}
                        className="flex items-center space-x-2 text-gray-300 hover:text-blue-300 transition-all duration-200 group py-1"
                        aria-label={link.ariaLabel}
                      >
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transform translate-x-1 group-hover:translate-x-0 transition-all duration-200" />
                        <span className="group-hover:translate-x-1 transition-transform duration-200">{link.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h3 className="text-white font-bold text-lg mb-6 relative">
                  Legal
                  <div className="absolute -bottom-2 left-0 w-8 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"></div>
                </h3>
                <ul className="space-y-3 mb-8">
                  {legal.map((link, index) => (
                    <li key={index}>
                      <Link
                        href={link.href}
                        className="flex items-center space-x-2 text-gray-300 hover:text-blue-300 transition-all duration-200 group py-1"
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
                  <div className="flex flex-wrap gap-2">
                    <div className="px-3 py-2 bg-white/10 rounded-lg text-xs text-gray-300 backdrop-blur-sm border border-white/10">
                      💳 Visa
                    </div>
                    <div className="px-3 py-2 bg-white/10 rounded-lg text-xs text-gray-300 backdrop-blur-sm border border-white/10">
                      💳 Mastercard
                    </div>
                    <div className="px-3 py-2 bg-white/10 rounded-lg text-xs text-gray-300 backdrop-blur-sm border border-white/10">
                      📱 PayPal
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
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                  aria-label="Email address for newsletter subscription"
                  required
                />
              </div>
              <button
                type="submit"
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 font-semibold flex items-center justify-center space-x-2 hover:shadow-lg hover:shadow-blue-500/25 hover:scale-105"
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
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center space-x-2 text-gray-300">
              <span>© {currentYear} BooknPay. Made with</span>
              <Heart className="w-4 h-4 text-red-500 animate-pulse" />
              <span>for travelers everywhere.</span>
            </div>
            
            <div className="flex items-center space-x-6 text-sm text-gray-400">
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4" />
                <span>Global Coverage</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>10M+ Users</span>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4" />
                <span>Instant Booking</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;