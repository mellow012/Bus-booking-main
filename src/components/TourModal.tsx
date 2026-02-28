import React, { useEffect, useRef, useState } from 'react';
import { X, ArrowRight, ArrowLeft, Search, CreditCard, CheckCircle, MapPin, Zap, Shield } from 'lucide-react';

interface TourModalProps {
  open: boolean;
  onClose: () => void;
}

const slides = [
  {
    id:          'search',
    step:        '01',
    title:       'Find Your Route',
    headline:    'Search any destination across Malawi',
    description: 'Filter by city, date and number of passengers. See real-time availability from all partner companies in one place.',
    icon:        Search,
    accent:      'from-blue-500 to-indigo-600',
    lightAccent: 'from-blue-50 to-indigo-50',
    iconBg:      'bg-blue-100',
    iconColor:   'text-blue-600',
    dotColor:    'bg-blue-500',
    illustration: (
      <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Map background */}
        <rect width="320" height="200" rx="16" fill="#EFF6FF"/>
        {/* Route lines */}
        <path d="M40 160 Q80 60 160 80 Q240 100 280 40" stroke="#BFDBFE" strokeWidth="2" strokeDasharray="6 4" fill="none"/>
        <path d="M40 140 Q100 100 160 110 Q220 120 280 70" stroke="#93C5FD" strokeWidth="2.5" strokeDasharray="6 4" fill="none"/>
        {/* City dots */}
        {[[40,160],[160,80],[280,40],[160,110],[280,70]].map(([cx,cy],i)=>(
          <circle key={i} cx={cx} cy={cy} r="5" fill="#3B82F6" opacity={i===0||i===2?"1":"0.5"}/>
        ))}
        <circle cx="40" cy="160" r="9" fill="#3B82F6" opacity="0.2"/>
        <circle cx="280" cy="40" r="9" fill="#3B82F6" opacity="0.2"/>
        {/* Search box mock */}
        <rect x="60" y="16" width="200" height="36" rx="10" fill="white" stroke="#BFDBFE" strokeWidth="1.5"/>
        <circle cx="82" cy="34" r="6" stroke="#93C5FD" strokeWidth="1.5" fill="none"/>
        <line x1="86.2" y1="38.2" x2="90" y2="42" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round"/>
        <rect x="96" y="28" width="80" height="6" rx="3" fill="#BFDBFE"/>
        <rect x="96" y="38" width="50" height="4" rx="2" fill="#DBEAFE"/>
        <rect x="220" y="24" width="28" height="20" rx="6" fill="#3B82F6"/>
        <path d="M228 33 L234 33 M234 33 L231 30 M234 33 L231 36" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Location pins */}
        <path d="M40 160 L40 150 Q40 143 47 143 Q54 143 54 150 Q54 157 47 162 Q44 165 40 160Z" fill="#2563EB"/>
        <circle cx="47" cy="150" r="3" fill="white"/>
        <path d="M280 40 L280 30 Q280 23 287 23 Q294 23 294 30 Q294 37 287 42 Q284 45 280 40Z" fill="#2563EB"/>
        <circle cx="287" cy="30" r="3" fill="white"/>
      </svg>
    ),
  },
  {
    id:          'select',
    step:        '02',
    title:       'Pick Your Seat',
    headline:    'Choose comfort, compare prices',
    description: 'View bus type, amenities and available seats at a glance. Pick the departure time that fits your schedule.',
    icon:        CreditCard,
    accent:      'from-emerald-500 to-teal-600',
    lightAccent: 'from-emerald-50 to-teal-50',
    iconBg:      'bg-emerald-100',
    iconColor:   'text-emerald-600',
    dotColor:    'bg-emerald-500',
    illustration: (
      <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="320" height="200" rx="16" fill="#ECFDF5"/>
        {/* Bus outline */}
        <rect x="40" y="60" width="240" height="110" rx="14" fill="white" stroke="#A7F3D0" strokeWidth="1.5"/>
        <rect x="40" y="60" width="240" height="30" rx="14" fill="#D1FAE5"/>
        {/* Windows row */}
        {[70,110,150,190,230].map((x,i)=>(
          <rect key={i} x={x} y="68" width="24" height="16" rx="4" fill={i===1?"#10B981":"white"} stroke="#6EE7B7" strokeWidth="1"/>
        ))}
        {/* Seat grid */}
        {[0,1,2,3].map(row=>(
          [0,1,2,3,4].map(col=>{
            const taken = (row===0&&col===1)||(row===1&&col===3)||(row===2&&col===0)||(row===3&&col===2);
            const selected = row===1&&col===1;
            return (
              <rect key={`${row}-${col}`}
                x={64+col*46} y={102+row*16} width="36" height="10" rx="3"
                fill={selected?"#10B981":taken?"#FCA5A5":"#D1FAE5"}
                stroke={selected?"#059669":taken?"#EF4444":"#6EE7B7"} strokeWidth="1"/>
            );
          })
        ))}
        {/* Legend */}
        <rect x="60" y="175" width="10" height="8" rx="2" fill="#D1FAE5" stroke="#6EE7B7" strokeWidth="1"/>
        <rect x="78" y="175" width="10" height="8" rx="2" fill="#10B981" stroke="#059669" strokeWidth="1"/>
        <rect x="96" y="175" width="10" height="8" rx="2" fill="#FCA5A5" stroke="#EF4444" strokeWidth="1"/>
        <rect x="60+18" y="175" width="0" height="0"/>
        {/* Price tag */}
        <rect x="220" y="168" width="80" height="24" rx="8" fill="#10B981"/>
        <text x="232" y="184" fontSize="11" fill="white" fontWeight="600">MWK 5,500</text>
      </svg>
    ),
  },
  {
    id:          'pay',
    step:        '03',
    title:       'Book & Go',
    headline:    'Instant confirmation, zero hassle',
    description: 'Pay securely and receive your e-ticket immediately. Show it on your phone — no printing needed.',
    icon:        CheckCircle,
    accent:      'from-violet-500 to-purple-600',
    lightAccent: 'from-violet-50 to-purple-50',
    iconBg:      'bg-violet-100',
    iconColor:   'text-violet-600',
    dotColor:    'bg-violet-500',
    illustration: (
      <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="320" height="200" rx="16" fill="#F5F3FF"/>
        {/* Phone */}
        <rect x="110" y="20" width="100" height="160" rx="16" fill="white" stroke="#DDD6FE" strokeWidth="1.5"/>
        <rect x="118" y="32" width="84" height="120" rx="8" fill="#F5F3FF"/>
        {/* Ticket */}
        <rect x="124" y="40" width="72" height="104" rx="6" fill="white" stroke="#C4B5FD" strokeWidth="1"/>
        {/* Checkmark circle */}
        <circle cx="160" cy="72" r="18" fill="#7C3AED" opacity="0.1"/>
        <circle cx="160" cy="72" r="14" fill="#7C3AED"/>
        <path d="M152 72 L157 77 L168 66" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Ticket details */}
        <rect x="132" y="96" width="56" height="5" rx="2.5" fill="#DDD6FE"/>
        <rect x="136" y="106" width="48" height="4" rx="2" fill="#EDE9FE"/>
        <rect x="140" y="114" width="40" height="4" rx="2" fill="#EDE9FE"/>
        {/* Barcode */}
        {[0,3,6,9,12,15,18,21,24,27,30].map((x,i)=>(
          <rect key={i} x={132+x} y="124" width={i%3===0?2:1} height="12" rx="0.5" fill="#7C3AED" opacity="0.6"/>
        ))}
        {/* Home button */}
        <rect x="148" y="172" width="24" height="4" rx="2" fill="#DDD6FE"/>
        {/* Confetti */}
        {[[60,40,'#FCD34D'],[260,60,'#34D399'],[70,140,'#F472B6'],[255,130,'#60A5FA'],[80,80,'#A78BFA']].map(([x,y,c],i)=>(
          <rect key={i} x={x as number} y={y as number} width="8" height="8" rx="2"
            fill={c as string} opacity="0.7"
            transform={`rotate(${i*30} ${(x as number)+4} ${(y as number)+4})`}/>
        ))}
      </svg>
    ),
  },
];

export default function TourModal({ open, onClose }: TourModalProps) {
  const [index,     setIndex]     = useState(0);
  const [animDir,   setAnimDir]   = useState<'forward'|'back'>('forward');
  const [animating, setAnimating] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setIndex(0);
      setTimeout(() => closeRef.current?.focus(), 50);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') navigate('forward');
      if (e.key === 'ArrowLeft')  navigate('back');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, index]);

  if (!open) return null;

  const navigate = (dir: 'forward' | 'back') => {
    if (animating) return;
    if (dir === 'forward' && index === slides.length - 1) { onClose(); return; }
    if (dir === 'back'    && index === 0) return;
    setAnimDir(dir);
    setAnimating(true);
    setTimeout(() => {
      setIndex(i => dir === 'forward' ? i + 1 : i - 1);
      setAnimating(false);
    }, 200);
  };

  const slide = slides[index];
  const Icon  = slide.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <style>{`
        @keyframes slideInRight  { from{opacity:0;transform:translateX(32px)}  to{opacity:1;transform:translateX(0)} }
        @keyframes slideInLeft   { from{opacity:0;transform:translateX(-32px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slideOutRight { from{opacity:1;transform:translateX(0)} to{opacity:0;transform:translateX(32px)} }
        @keyframes slideOutLeft  { from{opacity:1;transform:translateX(0)} to{opacity:0;transform:translateX(-32px)} }
        .slide-enter-forward { animation: slideInRight .25s ease-out both }
        .slide-enter-back    { animation: slideInLeft  .25s ease-out both }
        .slide-exit-forward  { animation: slideOutLeft  .2s ease-in  both }
        .slide-exit-back     { animation: slideOutRight .2s ease-in  both }
      `}</style>

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true"/>

      <div
        role="dialog" aria-modal="true" aria-labelledby={`tour-title-${slide.id}`}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Gradient header band */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${slide.accent} transition-all duration-500`}/>

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg ${slide.iconBg} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${slide.iconColor}`}/>
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
              Step {slide.step}
            </span>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close tour"
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4"/>
          </button>
        </div>

        {/* Content area */}
        <div className={`px-6 pt-4 pb-2 ${animating ? (animDir==='forward'?'slide-exit-forward':'slide-exit-back') : (animDir==='forward'?'slide-enter-forward':'slide-enter-back')}`}>

          {/* Illustration */}
          <div className={`w-full h-44 rounded-2xl overflow-hidden bg-gradient-to-br ${slide.lightAccent} mb-5`}>
            {slide.illustration}
          </div>

          {/* Text */}
          <h3 id={`tour-title-${slide.id}`}
            className="text-xl font-extrabold text-gray-900 mb-1 tracking-tight">
            {slide.headline}
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed">{slide.description}</p>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 flex items-center justify-between">
          {/* Step dots */}
          <div className="flex items-center gap-2">
            {slides.map((s, i) => (
              <button key={s.id} onClick={() => { if (i !== index) { setAnimDir(i>index?'forward':'back'); setIndex(i); }}}
                className={`rounded-full transition-all duration-300 ${
                  i === index ? `w-6 h-2.5 ${slide.dotColor}` : 'w-2.5 h-2.5 bg-gray-200 hover:bg-gray-300'
                }`} aria-label={`Go to step ${i+1}`}/>
            ))}
          </div>

          {/* Nav buttons */}
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button onClick={() => navigate('back')}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                <ArrowLeft className="w-3.5 h-3.5"/> Back
              </button>
            )}
            {index === 0 && (
              <button onClick={onClose}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Skip
              </button>
            )}
            <button onClick={() => navigate('forward')}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r ${slide.accent} hover:opacity-90 transition-opacity shadow-md`}>
              {index < slides.length - 1 ? <>Next <ArrowRight className="w-3.5 h-3.5"/></> : <>Get Started <Zap className="w-3.5 h-3.5"/></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}