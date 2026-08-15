'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Building2, MapPin, CalendarDays, Users2,
  BadgeDollarSign, Phone, MessageSquareDot,
  Loader2, AlertCircle, Bus, SendHorizonal, ImagePlus, X, ChevronLeft,
} from 'lucide-react';
import { uploadBusImage } from '@/utils/supabase/storage-utils';

interface Company {
  id: string;
  name: string;
  logo: string | null;
}

interface RequestFormClientProps {
  companies: Company[];
}

/* ── exact same tokens as HomeSearch ─────────────────────────── */
const inputCls =
  'w-full pl-9 pr-3 h-11 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-700 outline-none transition-all';
const labelCls =
  'block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1';
const iconCls =
  'absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none';

export default function RequestFormClient({ companies }: RequestFormClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Check tab query parameter: tab=own / mode=own => useOwnBus = true
  const initialTab = searchParams ? (searchParams.get('tab') || searchParams.get('mode')) : null;
  const [useOwnBus, setUseOwnBus] = useState(initialTab === 'own' || initialTab === 'my-bus' || initialTab === 'direct');

  useEffect(() => {
    if (!searchParams) return;
    const tabParam = searchParams.get('tab') || searchParams.get('mode');
    if (tabParam === 'own' || tabParam === 'my-bus' || tabParam === 'direct') {
      setUseOwnBus(true);
    } else if (tabParam === 'platform' || tabParam === 'company') {
      setUseOwnBus(false);
    }
  }, [searchParams]);

  /* shared */
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [pickupPoint, setPickupPoint] = useState('');
  const [dropoffPoint, setDropoffPoint] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');

  /* platform bus */
  const [companyId, setCompanyId] = useState('');
  const [seatsRequested, setSeatsRequested] = useState('');
  const [proposedFare, setProposedFare] = useState('');

  /* own bus */
  const [busName, setBusName] = useState('');
  const [totalSeats, setTotalSeats] = useState('');
  const [fare, setFare] = useState('');

  /* bus images (local previews only — My Bus tab) */
  const [busImages, setBusImages] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages = files.slice(0, 5 - busImages.length).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setBusImages((prev) => [...prev, ...newImages].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setBusImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  /* ── Seat map helper ── */
  const renderSeatMap = () => {
    const total = parseInt(useOwnBus ? totalSeats : seatsRequested, 10);
    if (!total || total <= 0 || total > 100) return null;
    const seatsPerRow = 4;
    const rowsCount = Math.ceil(total / seatsPerRow);
    const seats = Array.from({ length: total }, (_, i) => i + 1);

    return (
      <div className="border border-gray-100 bg-slate-50/50 rounded-2xl p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Bus Layout Preview</h4>
            <p className="text-[10px] text-gray-400 mt-0.5">{total} seats · {rowsCount} rows</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase">
              <span className="w-2.5 h-2.5 bg-brand-500 rounded border border-brand-600 block" /> Driver
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase">
              <span className="w-2.5 h-2.5 bg-white rounded border border-gray-300 block" /> Seat
            </span>
          </div>
        </div>

        <div className="max-w-[240px] mx-auto border-[3px] border-slate-300 rounded-t-3xl rounded-b-xl bg-white p-3.5 shadow-inner">
          {/* Driver cabin */}
          <div className="flex justify-between items-center border-b-2 border-dashed border-slate-200 pb-3 mb-3">
            <div className="w-7 h-7 rounded-full bg-brand-500 border border-brand-600 flex items-center justify-center text-[8px] font-black text-white shadow-sm">
              D
            </div>
            <div className="h-5 w-10 bg-slate-100 rounded border border-slate-200 text-[7px] uppercase tracking-wider text-slate-400 font-bold flex items-center justify-center">
              Door
            </div>
          </div>

          {/* Seat rows */}
          <div className="space-y-2">
            {Array.from({ length: rowsCount }).map((_, rowIndex) => {
              const rowStart = rowIndex * seatsPerRow;
              const rowSeats = seats.slice(rowStart, rowStart + seatsPerRow);
              return (
                <div key={rowIndex} className="flex justify-between items-center gap-1">
                  <div className="flex gap-1 w-2/5 justify-end">
                    {rowSeats.slice(0, 2).map((n) => (
                      <div key={n} className="w-7 h-7 rounded-md border border-gray-300 bg-white flex items-center justify-center text-[9px] font-bold text-slate-600 shadow-sm hover:border-brand-500 transition-all cursor-default">
                        {n}
                      </div>
                    ))}
                    {rowSeats.length < 2 && <div className="w-7 h-7 opacity-0" />}
                  </div>
                  <div className="w-1/5 text-center text-[7px] font-bold text-gray-300 uppercase tracking-widest">···</div>
                  <div className="flex gap-1 w-2/5 justify-start">
                    {rowSeats.slice(2, 4).map((n) => (
                      <div key={n} className="w-7 h-7 rounded-md border border-gray-300 bg-white flex items-center justify-center text-[9px] font-bold text-slate-600 shadow-sm hover:border-brand-500 transition-all cursor-default">
                        {n}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      (!useOwnBus && (!companyId || !origin || !destination || !travelDate || !seatsRequested || !proposedFare || !contactPhone)) ||
      (useOwnBus && (!busName || !totalSeats || !fare || !origin || !destination || !travelDate || !contactPhone))
    ) {
      setError('Please fill in all required fields.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      
      const travelDateObj = new Date(travelDate);
      if (isNaN(travelDateObj.getTime())) {
        setError('Invalid travel date format.');
        setLoading(false);
        return;
      }
      
      let uploadedImageUrls: string[] = [];
      if (busImages.length > 0) {
        const uniqueUploadId = crypto.randomUUID();
        try {
          const uploadPromises = busImages.map(img => 
            uploadBusImage(img.file, 'chatter', uniqueUploadId)
          );
          uploadedImageUrls = await Promise.all(uploadPromises);
        } catch (uploadErr: any) {
          setError(`Failed to upload images: ${uploadErr.message}`);
          setLoading(false);
          return;
        }
      }

      const timeString = travelDate.split('T')[1] || '00:00';
      const body = useOwnBus
        ? { useOwnBus: true, busName, totalSeats: parseInt(totalSeats, 10), fare: parseInt(fare, 10), origin, destination, pickupPoint, dropoffPoint, travelDate: travelDateObj.toISOString(), departureTime: timeString, contactPhone, notes, images: uploadedImageUrls }
        : { useOwnBus: false, companyId, origin, destination, pickupPoint, dropoffPoint, travelDate: travelDateObj.toISOString(), departureTime: timeString, seatsRequested: parseInt(seatsRequested, 10), proposedFare: parseInt(proposedFare, 10), contactPhone, notes, images: uploadedImageUrls };

      const res = await fetch('/api/chatter/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || 'Failed to submit request.'); return; }
      router.push('/chatter/my-schedules');
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Back button & title */}
      <div className="flex items-center gap-2">
        <Link href="/chatter/my-schedules" className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors border border-gray-200">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">New Trip Request</span>
      </div>

      {/* ── Tab bar — same style as Today/Tomorrow toggle in HomeSearch ── */}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => { setUseOwnBus(true); setError(null); }}
          className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest py-3 rounded-xl border transition-all duration-200 ${useOwnBus
              ? 'bg-coral-500 text-white border-coral-500 shadow-md shadow-coral-50'
              : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-coral-100 hover:text-coral-500 hover:bg-white'
            }`}
        >
          <Bus className="w-3.5 h-3.5" />
          My Bus
        </button>
        <button
          type="button"
          onClick={() => { setUseOwnBus(false); setError(null); }}
          className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest py-3 rounded-xl border transition-all duration-200 ${!useOwnBus
              ? 'bg-brand-700 text-white border-brand-700 shadow-md shadow-brand-50'
              : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-brand-100 hover:text-brand-700 hover:bg-white'
            }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Platform Bus
        </button>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-red-600 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* ── Fields ── */}
      {!useOwnBus ? (
        <div className="space-y-4">
          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Bus Company</label>
              <div className="relative">
                <Building2 className={iconCls} />
                <select required className={`${inputCls} appearance-none`}
                  value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                  <option value="">Choose a company…</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Origin</label>
              <div className="relative">
                <MapPin className={iconCls} />
                <input type="text" required placeholder="e.g. Lilongwe" className={inputCls}
                  value={origin} onChange={(e) => setOrigin(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Destination</label>
              <div className="relative">
                <MapPin className={iconCls} />
                <input type="text" required placeholder="e.g. Blantyre" className={inputCls}
                  value={destination} onChange={(e) => setDestination(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Pickup / Drop-off */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Pickup Point <span className="normal-case font-normal text-gray-400">(optional)</span></label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 pointer-events-none" />
                <input type="text" placeholder="e.g. Lilongwe Bus Depot, Gate 3" className={inputCls}
                  value={pickupPoint} onChange={(e) => setPickupPoint(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Drop-off Point <span className="normal-case font-normal text-gray-400">(optional)</span></label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400 pointer-events-none" />
                <input type="text" placeholder="e.g. Blantyre Civic Centre" className={inputCls}
                  value={dropoffPoint} onChange={(e) => setDropoffPoint(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>Travel Date</label>
              <div className="relative">
                <CalendarDays className={iconCls} />
                <input type="datetime-local" required className={inputCls}
                  value={travelDate} onChange={(e) => setTravelDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Seats Requested</label>
              <div className="relative">
                <Users2 className={iconCls} />
                <input type="number" required min="1" placeholder="e.g. 30" className={inputCls}
                  value={seatsRequested} onChange={(e) => setSeatsRequested(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Fare / Seat (MWK)</label>
              <div className="relative">
                <BadgeDollarSign className={iconCls} />
                <input type="number" required min="0" placeholder="e.g. 3500" className={inputCls}
                  value={proposedFare} onChange={(e) => setProposedFare(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Contact Phone</label>
              <div className="relative">
                <Phone className={iconCls} />
                <input type="tel" required placeholder="+265…" className={inputCls}
                  value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Bus Name / Operator</label>
              <div className="relative">
                <Bus className={iconCls} />
                <input type="text" required placeholder="e.g. Kadewele Coach" className={inputCls}
                  value={busName} onChange={(e) => setBusName(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Total Seats</label>
              <div className="relative">
                <Users2 className={iconCls} />
                <input type="number" required min="1" placeholder="e.g. 40" className={inputCls}
                  value={totalSeats} onChange={(e) => setTotalSeats(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Fare per Seat (MWK)</label>
              <div className="relative">
                <BadgeDollarSign className={iconCls} />
                <input type="number" required min="0" placeholder="e.g. 2000" className={inputCls}
                  value={fare} onChange={(e) => setFare(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Pickup / Drop-off */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Pickup Point <span className="normal-case font-normal text-gray-400">(optional)</span></label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 pointer-events-none" />
                <input type="text" placeholder="e.g. Lilongwe Bus Depot, Gate 3" className={inputCls}
                  value={pickupPoint} onChange={(e) => setPickupPoint(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Drop-off Point <span className="normal-case font-normal text-gray-400">(optional)</span></label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400 pointer-events-none" />
                <input type="text" placeholder="e.g. Blantyre Civic Centre" className={inputCls}
                  value={dropoffPoint} onChange={(e) => setDropoffPoint(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>Origin</label>
              <div className="relative">
                <MapPin className={iconCls} />
                <input type="text" required placeholder="e.g. Lilongwe" className={inputCls}
                  value={origin} onChange={(e) => setOrigin(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Destination</label>
              <div className="relative">
                <MapPin className={iconCls} />
                <input type="text" required placeholder="e.g. Blantyre" className={inputCls}
                  value={destination} onChange={(e) => setDestination(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Travel Date</label>
              <div className="relative">
                <CalendarDays className={iconCls} />
                <input type="datetime-local" required className={inputCls}
                  value={travelDate} onChange={(e) => setTravelDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Contact Phone</label>
              <div className="relative">
                <Phone className={iconCls} />
                <input type="tel" required placeholder="+265…" className={inputCls}
                  value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Seat Map Preview ── */}
      {renderSeatMap()}

      {/* ── Bus Images (My Bus tab only) ── */}
      {useOwnBus && (
        <div className="border border-gray-100 bg-slate-50/50 rounded-2xl p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Bus Photos</h4>
              <p className="text-[10px] text-gray-400 mt-0.5">Upload up to 5 images so passengers can see the bus ({busImages.length}/5)</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {busImages.map((img, i) => (
              <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 shadow-sm group">
                <Image src={img.preview} alt={`Bus photo ${i + 1}`} fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(i)}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {busImages.length < 5 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 bg-white hover:border-brand-500 hover:bg-brand-50/30 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer"
              >
                <ImagePlus className="w-5 h-5 text-gray-400" />
                <span className="text-[9px] font-bold text-gray-400 uppercase">Add</span>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleAddImages}
          />
        </div>
      )}

      {/* ── Notes + Submit ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-end">
        <div className="lg:col-span-3">
          <label className={labelCls}>Notes / Requirements</label>
          <div className="relative">
            <MessageSquareDot className="absolute left-2.5 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
            <textarea
              rows={3}
              placeholder="Special instructions, pickup details, accessibility needs…"
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-700 outline-none transition-all resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="lg:col-span-1">
          <button
            type="submit"
            disabled={loading}
            className={`w-full h-[84px] flex items-center justify-center gap-2 font-semibold text-sm text-white rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${useOwnBus
                ? 'bg-coral-500 hover:bg-coral-600'
                : 'bg-coral-500 hover:bg-coral-600'
              }`}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <SendHorizonal className="w-4 h-4" />
                Submit Request
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
