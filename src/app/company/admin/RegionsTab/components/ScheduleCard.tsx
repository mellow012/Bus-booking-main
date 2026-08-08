'use client';

import { Calendar, Bus as BusIcon, Trash2, Loader2, Bell, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Bus, Schedule } from '@/types';
import { SCHEDULE_STATUS_LABELS, SCHEDULE_STATUS_STYLES, formatDateTime, getScheduleStatus } from '../utils/schedule';
import { deleteSchedule } from '@/lib/actions/schedule.actions';
import { useAppToast } from '@/contexts/ToastContext';

interface ScheduleCardProps {
  schedule: Schedule;
  bus?: Bus;
  seatsBooked: number;
  totalSeats: number;
  revenue: number;
  baseUrl?: string;
  operatorName?: string;
  onDeleteSuccess?: () => void;
}

export default function ScheduleCard({ schedule, bus, seatsBooked, totalSeats, revenue, baseUrl = '/company/admin', operatorName, onDeleteSuccess }: ScheduleCardProps) {
  const router = useRouter();
  const toast = useAppToast();
  const status = getScheduleStatus(schedule);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = `${window.location.origin}/bus/${schedule.id}`;
    if (navigator.share) {
      navigator.share({
        title: 'Book Bus Ticket',
        text: `Book your bus ticket now!`,
        url: link,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(link);
      toast.success('Link copied', 'Schedule link copied to clipboard!');
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;
    
    setIsDeleting(true);
    try {
      const result = await deleteSchedule(schedule.id);
      if (result.success) {
        if (onDeleteSuccess) onDeleteSuccess();
      } else {
        alert(result.error || 'Failed to delete schedule');
      }
    } catch (err: any) {
      alert(err.message || 'An unexpected error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div 
      onClick={() => router.push(`${baseUrl}?tab=bookings&scheduleId=${encodeURIComponent(schedule.id)}`)}
      className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-indigo-200 cursor-pointer transition-colors"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <p className="font-bold text-sm text-gray-900">
            {formatDateTime(typeof schedule.departureDateTime === 'string' ? schedule.departureDateTime : schedule.departureDateTime.toISOString())}
          </p>
          <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${SCHEDULE_STATUS_STYLES[status]}`}>
            {SCHEDULE_STATUS_LABELS[status]}
          </span>
        </div>
        <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5 ml-10">
          <BusIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span>{bus ? `${bus.licensePlate} (${bus.capacity} seats)` : 'Unassigned bus'}</span>
          <span className="text-gray-300 ml-2">|</span>
          <span className="text-green-600 font-semibold ml-2">MWK {revenue.toLocaleString()} Revenue</span>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-4 sm:gap-6 sm:border-l border-gray-100 sm:pl-6 shrink-0 mt-2 sm:mt-0 ml-10 sm:ml-0">
        <div className="text-center">
          <p className="text-xl font-black text-emerald-600 leading-none">{seatsBooked}/{totalSeats}</p>
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">Seats Booked</p>
        </div>
        
        <div className="w-px h-8 bg-gray-100 hidden sm:block"></div>
        
        <button
          onClick={handleShare}
          title="Share Schedule Link"
          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors self-center"
        >
          <Share2 className="w-5 h-5" />
        </button>

        <div className="w-px h-8 bg-gray-100 hidden sm:block"></div>
        
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          title="Delete Schedule"
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50 self-center"
        >
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}