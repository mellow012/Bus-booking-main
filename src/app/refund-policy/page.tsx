import React from 'react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Refund & Cancellation Policy | TibhukeBus',
  description: 'Official refund rules and 2-hour pre-departure cancellation policy for TibhukeBus bookings.',
};

export default function RefundPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-12">
        <div className="mb-8 border-b pb-6">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
            Refund &amp; Cancellation Policy
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Last updated: August 3, 2026 · Standard terms across all registered bus operators in Malawi.
          </p>
        </div>

        <div className="prose prose-indigo max-w-none text-gray-700 space-y-6">
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
            <h3 className="text-amber-800 font-bold text-base m-0">
              Notice: 2-Hour Pre-Departure Refund Cutoff Rule
            </h3>
            <p className="text-amber-700 text-sm mt-1 mb-0">
              Bookings may be cancelled for a full refund up to <strong>2 hours before departure time</strong>. Within 2 hours of departure, cancellations and refunds are blocked automatically by our server policy.
            </p>
          </div>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Eligible Refunds (2+ Hours Before Departure)</h2>
            <p>
              Passengers may request cancellation through their TibhukeBus account dashboard or via customer support at least 2 hours prior to scheduled departure. Upon successful cancellation, funds will be refunded to the original mobile money or payment account within 24 to 48 hours.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Ineligible Refunds (&lt; 2 Hours Before Departure)</h2>
            <p>
              Cancellations requested within 2 hours of departure time or after the bus has departed are non-refundable. This policy protects bus operators from unfillable last-minute seat vacancies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Operator Cancellations &amp; Schedule Disruptions</h2>
            <p>
              If a bus operator cancels a scheduled trip due to breakdown, severe weather, or operational reasons, passengers are entitled to a <strong>100% full refund</strong> or a free transfer to the next available schedule.
            </p>
          </section>

          <section className="border-t pt-6 mt-8">
            <p className="text-sm text-gray-500">
              To request assistance with a refund claim, please email{' '}
              <a href="mailto:support@tibhukebus.com" className="text-brand-600 font-semibold hover:underline">
                support@tibhukebus.com
              </a>{' '}
              with your Booking Reference number.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
