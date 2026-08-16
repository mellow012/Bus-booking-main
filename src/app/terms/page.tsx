import React from 'react';
import Link from 'next/link';
import BackButton from '@/components/BackButton';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Terms of Service | TibhukeBus',
  description: 'Terms of Service for bus ticket bookings, e-tickets, and passenger rules on TibhukeBus.',
};

export default function TermsOfServicePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-4">
        <BackButton hideOnMobile={false} />
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-12">
        <div className="mb-8 border-b pb-6">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Last updated: August 3, 2026 · Governed under the laws of the Republic of Malawi.
          </p>
        </div>

        <div className="prose prose-indigo max-w-none text-gray-700 space-y-6">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. E-Tickets &amp; Boarding Verification</h2>
            <p>
              A valid TibhukeBus e-ticket (digital or printed) containing a valid booking reference and seat number is required for boarding. Passengers must present valid identification matching the ticket name upon request by the bus conductor.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Seat Reservations &amp; Hold Expiry</h2>
            <p>
              Seat holds created during checkout are reserved temporarily for 5 minutes while completing payment. Unpaid holds automatically expire after 5 minutes, releasing the seat back into the public inventory.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Passenger Conduct &amp; Luggage</h2>
            <p>
              Passengers are required to arrive at the boarding terminal at least 15 minutes prior to scheduled departure. Standard hand luggage is permitted free of charge. Hazardous materials or prohibited items are strictly forbidden.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Cancellations &amp; Refund Policy</h2>
            <p>
              Bookings can be cancelled and refunded up to <strong>2 hours prior to scheduled departure time</strong>. Cancellations within 2 hours of departure are strictly non-refundable as per our server-enforced cutoff policy. For full details, view our{' '}
              <Link href="/refund-policy" className="text-brand-600 font-semibold hover:underline">
                Refund &amp; Cancellation Policy
              </Link>.
            </p>
          </section>

          <section className="border-t pt-6 mt-8">
            <p className="text-sm text-gray-500">
              If you have questions regarding these Terms, contact customer service at{' '}
              <a href="mailto:support@tibhukebus.com" className="text-brand-600 font-semibold hover:underline">
                support@tibhukebus.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
