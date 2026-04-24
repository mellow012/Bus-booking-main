import React from "react";
import { Star, ArrowRight, Calendar, Users, Clock, MapPin, Bus as BusIcon, Flame, CheckCircle, Shield, Navigation } from "lucide-react";
import { EnhancedSchedule, fillingFast, seatColor, cityMatch, formatDuration, isToday, AMENITY_ICONS, getScheduleCategory } from "@/utils/homeHelpers";

export const ScheduleCard = React.memo(({ s, onBook, userCity }: {
  s: EnhancedSchedule; onBook: () => void; userCity: string | null;
}) => {
  const filling = fillingFast(s.availableSeats, s.totalSeats);
  const seatCls = seatColor(s.availableSeats, s.totalSeats);
  const isLocal = userCity ? cityMatch(s, userCity) : false;
  const category = getScheduleCategory(s);

  return (
    <article className="group bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-blue-100 transition-all duration-300 overflow-hidden flex flex-col">
      <div className={`h-[3px] w-full ${filling ? "bg-gradient-to-r from-rose-400 to-orange-400" : isLocal ? "bg-gradient-to-r from-teal-400 to-emerald-500" : "bg-gradient-to-r from-blue-500 to-indigo-500"}`} />

      <div className="p-4 sm:p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {s.companyLogo ? (
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl overflow-hidden border border-gray-100 shrink-0">
                <img src={s.companyLogo} alt={s.companyName} className="w-full h-full object-cover" loading="lazy" />
              </div>
            ) : (
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm sm:text-base shrink-0">
                {s.companyName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-xs sm:text-sm truncate group-hover:text-blue-700 transition-colors">{s.companyName}</p>
              <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5">
                <span className="text-[10px] sm:text-[11px] text-gray-500 bg-gray-100 px-1.5 sm:px-2 py-0.5 rounded-full">{s.busType}</span>
                <span className="flex items-center gap-0.5 text-[10px] sm:text-[11px] text-gray-500">
                  <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-400 fill-yellow-400" />4.6
                </span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-base sm:text-lg font-bold text-blue-700 leading-tight">MWK {s.price.toLocaleString()}</p>
            <p className="text-[10px] sm:text-[11px] text-gray-400">per person</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 sm:p-3 mb-3">
          <div className="flex items-center">
            <div className="text-center min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">{s.origin}</p>
              <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5">{s.departureTime}</p>
            </div>
            <div className="flex flex-col items-center gap-0.5 px-2 sm:px-3 shrink-0">
              <div className="flex items-center gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-300" />
                <div className="w-5 sm:w-7 h-px bg-blue-200" />
                <ArrowRight className="w-2.5 sm:w-3 h-2.5 sm:h-3 text-blue-500" />
                <div className="w-5 sm:w-7 h-px bg-blue-200" />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-300" />
              </div>
              <span className="text-[9px] sm:text-[10px] text-gray-400">{formatDuration(s.duration)}</span>
            </div>
            <div className="text-center min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">{s.destination}</p>
              <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5">{s.arrivalTime}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 sm:gap-1.5 mb-3">
          {[
            { icon: Calendar, label: new Date(s.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), cls: "text-blue-500" },
            { icon: Users, label: `${s.availableSeats} seats`, cls: seatCls, labelCls: seatCls },
            { icon: MapPin, label: `${s.distance} km`, cls: "text-blue-500" },
            { icon: BusIcon, label: s.busNumber, cls: "text-blue-500" },
          ].map(({ icon: Icon, label, cls, labelCls }, i) => (
            <div key={i} className="flex items-center gap-1 sm:gap-1.5 bg-gray-50 rounded-lg px-2 sm:px-2.5 py-1 sm:py-1.5">
              <Icon className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${cls}`} />
              <span className={`text-[10px] sm:text-xs font-medium truncate ${labelCls || "text-gray-700"}`}>{label}</span>
            </div>
          ))}
        </div>

        {s.amenities?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {s.amenities.slice(0, 3).map((a, i) => {
              const Icon = AMENITY_ICONS[a] || Shield; return (
                <span key={i} className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-50 text-blue-700 rounded-full">
                  <Icon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />{a}
                </span>
              );
            })}
            {s.amenities.length > 3 && <span className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 text-gray-500 rounded-full">+{s.amenities.length - 3}</span>}
          </div>
        )}

        <div className="flex flex-wrap gap-1 mb-3 min-h-[18px]">
          {category && (
            <span className={`flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full border font-semibold ${category === 'Boarding Now' ? 'bg-orange-50 text-orange-700 border-orange-200 animate-pulse' :
                category === 'Morning' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  category === 'Afternoon' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}>
              {category === 'Boarding Now' ? <Flame className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
              {category}
            </span>
          )}
          {filling && <span className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 sm:py-1 bg-rose-50 text-rose-600 rounded-full border border-rose-100 font-semibold"><Flame className="w-2.5 h-2.5 sm:w-3 sm:h-3" />Filling Fast</span>}
          {isToday(s.date) && <span className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 sm:py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 font-semibold"><CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />Today</span>}
          {isLocal && <span className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 sm:py-1 bg-teal-50 text-teal-700 rounded-full border border-teal-100 font-semibold"><MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3" />Near You</span>}
          {s.status === 'in_transit' && <span className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 sm:py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200 font-semibold shadow-sm animate-pulse"><Navigation className="w-2.5 h-2.5 sm:w-3 sm:h-3" />In Transit</span>}
          {s.status === 'completed' && <span className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-50 text-gray-600 rounded-full border border-gray-200 font-semibold"><CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />Completed</span>}
        </div>

        <button onClick={onBook} disabled={s.availableSeats <= 0}
          className="mt-auto w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 group/btn active:scale-[.98]">
          {s.availableSeats <= 0 ? "Fully Booked" : <>Book Journey <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" /></>}
        </button>
      </div>
    </article>
  );
});
ScheduleCard.displayName = "ScheduleCard";
