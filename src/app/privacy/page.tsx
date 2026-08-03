import React from 'react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Privacy Policy | TibhukeBus',
  description: 'Privacy Policy for TibhukeBus digital bus ticketing and live tracking platform in Malawi.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-12">
        <div className="mb-8 border-b pb-6">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Last updated: August 3, 2026 · Effective for all TibhukeBus passengers and bus operators.
          </p>
        </div>

        <div className="prose prose-indigo max-w-none text-gray-700 space-y-6">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Information We Collect</h2>
            <p>
              TibhukeBus (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) collects personal information to provide safe, reliable digital bus ticketing and real-time journey tracking across Malawi:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Account &amp; Contact Information:</strong> Name, phone number, email address, and account login credentials.</li>
              <li><strong>Passenger &amp; Booking Data:</strong> Passenger names, seat preferences, travel routes, departure times, and e-ticket references.</li>
              <li><strong>Location Information:</strong> Real-time device GPS coordinates when explicitly consented for live bus journey tracking.</li>
              <li><strong>Payment Information:</strong> Mobile money transaction reference numbers via PayChangu. We do not store raw credit card numbers or mobile money PINs on our servers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. How We Use Your Information</h2>
            <p>We use the collected information for the following core purposes:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Processing bus seat reservations, e-ticket issuance, and boarding verification.</li>
              <li>Sending essential departure reminders (T-60 minutes) and boarding alerts (T-15 minutes).</li>
              <li>Providing live journey tracking and estimated arrival times for passengers and family members.</li>
              <li>Preventing fraudulent bookings and enforcing per-seat concurrency locks.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Data Sharing &amp; Security</h2>
            <p>
              We do not sell passenger personal data to third parties. Information is shared strictly with authorized bus operators for boarding manifests and with PayChangu for payment verification. All data transmission is encrypted using industry-standard SSL/TLS protocols.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Your Rights &amp; Data Deletion</h2>
            <p>
              You have the right to inspect, correct, or request deletion of your personal data stored in your TibhukeBus account at any time by contacting support@tibhukebus.com.
            </p>
          </section>

          <section className="border-t pt-6 mt-8">
            <p className="text-sm text-gray-500">
              For privacy inquiries or data requests, contact our Data Protection Officer at{' '}
              <a href="mailto:privacy@tibhukebus.com" className="text-brand-600 font-semibold hover:underline">
                privacy@tibhukebus.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
