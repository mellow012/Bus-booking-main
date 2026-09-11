'use client';

import { useState } from 'react';
import { DollarSign, FileDown } from 'lucide-react';
import { Booking } from '@/types';
import { Button } from '@/components/ui/button';

interface PaymentsTabProps {
  tripBookings: Booking[];
}

export default function PaymentsTab({ tripBookings }: PaymentsTabProps) {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const paidBookings = tripBookings.filter(b => b.paymentStatus === 'paid');
  const totalCollected = paidBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  const cashCollected = paidBookings.filter(b => b.paymentMethod === 'cash').reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  const onlineCollected = totalCollected - cashCollected;
  const boarded = tripBookings.filter((booking) => ['confirmed', 'completed'].includes(booking.bookingStatus)).length;
  const noShows = tripBookings.filter((booking) => booking.bookingStatus === 'no-show').length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-4">
      <div className="flex gap-1 rounded-xl bg-white p-1 border">
        {(['today', 'week', 'month'] as const).map((key) => <button key={key} onClick={() => setPeriod(key)} className={`flex-1 rounded-lg py-2 text-xs font-bold capitalize ${period === key ? 'bg-brand-700 text-white' : 'text-gray-500'}`}>This {key === 'today' ? 'day' : key}</button>)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-white p-6 rounded-3xl border shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Collected</p>
            <p className="text-2xl font-black text-gray-900">MWK {totalCollected.toLocaleString()}</p>
         </div>
         <div className="grid grid-cols-2 gap-3">
           <div className="rounded-2xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-gray-400">Boarded</p><p className="text-2xl font-black text-brand-900">{boarded}</p></div>
           <div className="rounded-2xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-gray-400">No-show</p><p className="text-2xl font-black text-brand-900">{noShows}</p></div>
         </div>
         <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Cash on Hand</p>
            <p className="text-2xl font-black text-emerald-700">MWK {cashCollected.toLocaleString()}</p>
         </div>
         <div className="bg-brand-50 p-6 rounded-3xl border border-brand-100">
            <p className="text-[10px] font-bold text-brand-700 uppercase tracking-widest mb-1">Online/Prepaid</p>
            <p className="text-2xl font-black text-brand-700">MWK {onlineCollected.toLocaleString()}</p>
         </div>
      </div>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
         <div className="p-6 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-brand-700" /> Payment History
            </h3>
            <span className="text-xs font-bold text-gray-500">{paidBookings.length} transactions</span>
         </div>
         <Button variant="outline" className="w-full border-brand-200 text-brand-700"><FileDown className="mr-2 h-4 w-4" /> Generate report</Button>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50/50">
                     <th className="px-6 py-4">Ref</th>
                     <th className="px-6 py-4">Passenger</th>
                     <th className="px-6 py-4">Method</th>
                     <th className="px-6 py-4 text-right">Amount</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                  {paidBookings.map(b => (
                     <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-gray-500">{b.bookingReference}</td>
                        <td className="px-6 py-4 font-bold text-gray-900 text-sm">{b.passengerDetails?.[0]?.name || 'Unknown'}</td>
                        <td className="px-6 py-4">
                           <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${b.paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'}`}>
                              {b.paymentMethod}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-gray-900 text-sm">MWK {b.totalAmount?.toLocaleString()}</td>
                     </tr>
                  ))}
                  {paidBookings.length === 0 && (
                     <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-bold">No payments recorded yet.</td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
