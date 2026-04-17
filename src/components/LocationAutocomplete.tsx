import React, { useState, useEffect, useMemo, useRef } from "react";
import { MapPin, X } from "lucide-react";

interface LocationAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  onSelect: (v: string) => void;
  placeholder: string;
  icon: React.ElementType;
  cities: string[];
  exclude?: string;
  id?: string;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = new Uint16Array((m + 1) * (n + 1));
  for (let i = 0; i <= m; i++) dp[i * (n + 1)] = i;
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i * (n + 1) + j] = a[i - 1] === b[j - 1]
        ? dp[(i - 1) * (n + 1) + (j - 1)]
        : 1 + Math.min(
            dp[(i - 1) * (n + 1) + j],
            dp[i * (n + 1) + (j - 1)],
            dp[(i - 1) * (n + 1) + (j - 1)]
          );
    }
  }
  return dp[m * (n + 1) + n];
}

function isSubsequence(query: string, target: string): boolean {
  let qi = 0;
  for (let i = 0; i < target.length && qi < query.length; i++) {
    if (target[i] === query[qi]) qi++;
  }
  return qi === query.length;
}

function fuzzyScore(query: string, city: string): number {
  if (!query) return 500;
  const q = query.toLowerCase();
  const c = city.toLowerCase();

  if (c === q) return 1000;
  if (c.startsWith(q)) return 800;
  if (c.includes(q)) return 600 - c.indexOf(q);
  if (isSubsequence(q, c)) return 400;

  const firstWord = c.split(" ")[0];
  const dist = levenshtein(q, firstWord.slice(0, q.length + 2));
  const threshold = Math.max(1, Math.floor(q.length / 3));
  if (dist <= threshold) return 200 - dist * 20;

  return -1;
}

interface FuzzyResult { city: string; score: number }

function fuzzySearch(query: string, cities: string[], exclude?: string): string[] {
  const results: FuzzyResult[] = cities
    .filter(c => c !== exclude)
    .map(c => ({ city: c, score: fuzzyScore(query, c) }))
    .filter(r => r.score >= 0)
    .sort((a, b) => b.score - a.score);
  return results.slice(0, 8).map(r => r.city);
}

export const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  value, onChange, onSelect, placeholder, icon: Icon, cities, exclude, id,
}) => {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(
    () => fuzzySearch(value.trim(), cities, exclude),
    [cities, value, exclude]
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false); setHighlight(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (city: string) => {
    onSelect(city); onChange(city); setOpen(false); setHighlight(-1);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open || !suggestions.length) return;
    if (e.key === "ArrowDown")  { e.preventDefault(); setHighlight(h => Math.min(h + 1, suggestions.length - 1)); }
    if (e.key === "ArrowUp")    { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    if (e.key === "Enter" && highlight >= 0) { e.preventDefault(); pick(suggestions[highlight]); }
    if (e.key === "Escape")     { setOpen(false); setHighlight(-1); }
  };

  const highlight_text = (city: string, query: string) => {
    if (!query.trim()) return <span>{city}</span>;
    const idx = city.toLowerCase().indexOf(query.toLowerCase());
    if (idx !== -1) {
      return (
        <>
          {city.slice(0, idx)}
          <span className="font-bold text-blue-700">{city.slice(idx, idx + query.length)}</span>
          {city.slice(idx + query.length)}
        </>
      );
    }
    return <span>{city} <span className="text-[10px] text-gray-400 font-normal ml-1">~match</span></span>;
  };

  return (
    <div ref={wrapRef} className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10"/>
      <input
        ref={inputRef}
        id={id}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setHighlight(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        className="w-full pl-9 pr-8 h-11 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-shadow"
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        role="combobox"
      />
      {value && (
        <button onClick={() => { onChange(""); onSelect(""); inputRef.current?.focus(); }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-700 transition-colors rounded-md hover:bg-gray-100">
          <X className="w-3.5 h-3.5"/>
        </button>
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-3 pt-2.5 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Available cities</p>
          </div>
          <ul role="listbox" className="pb-1.5 max-h-52 overflow-y-auto">
            {suggestions.map((city, i) => (
              <li key={city} role="option" aria-selected={i === highlight}>
                <button
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => pick(city)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors ${
                    i === highlight ? "bg-blue-50 text-blue-800" : "text-gray-700 hover:bg-gray-50"
                  }`}>
                  <MapPin className={`w-3.5 h-3.5 shrink-0 ${i === highlight ? "text-blue-500" : "text-gray-300"}`}/>
                  <span>{highlight_text(city, value)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
