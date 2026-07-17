import React from "react";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/input";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export interface PassengerFormState {
  name: string;
  ageInput: string;
  age: number;
  gender: "male" | "female" | "other";
  seatNumber: string;
  ticketType: "adult" | "child" | "senior";
}

export interface InlinePassengerFormProps {
  passengers: number;
  formState: PassengerFormState[];
  onChange: (index: number, field: keyof PassengerFormState, value: string) => void;
  onAgeBlur: (index: number) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
  error: string;
  bookingForSelf: boolean;
  onToggleSelf: (val: boolean) => void;
}

const InlinePassengerForm: React.FC<InlinePassengerFormProps> = ({
  passengers, formState, onChange, onAgeBlur, onSubmit, onBack, loading, error,
  bookingForSelf, onToggleSelf,
}) => (
  <div className="space-y-5 min-w-0">
    <div className="flex items-center gap-2 mb-4 p-3 bg-brand-50/50 rounded-xl border border-brand-100">
      <input
        type="checkbox"
        id="bookingForSelf"
        checked={bookingForSelf}
        onChange={(e) => onToggleSelf(e.target.checked)}
        className="w-4 h-4 accent-brand-700 border-gray-300 rounded focus:ring-brand-700 cursor-pointer"
      />
      <Label htmlFor="bookingForSelf" className="text-sm font-semibold text-brand-800 cursor-pointer">
        I am travelling (Auto-fill my details)
      </Label>
    </div>
    {formState.map((p, i) => (
      <div key={i} className="p-4 border border-gray-200 rounded-xl bg-white space-y-4 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-7 h-7 rounded-full bg-brand-700 text-white text-xs font-bold flex items-center justify-center shrink-0">
            {i + 1}
          </span>
          <span className="font-semibold text-gray-800 text-sm">
            Passenger {i + 1} — Seat {p.seatNumber}
          </span>
        </div>
        <div>
          <Label htmlFor={`name-${i}`} className="mb-1 block text-sm">
            Full Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id={`name-${i}`} value={p.name}
            onChange={e => onChange(i, "name", e.target.value)}
            placeholder="e.g. Chisomo Banda" className="h-10 min-w-0" required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`age-${i}`} className="mb-1 block text-sm">
              Age <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`age-${i}`} type="text" inputMode="numeric" pattern="[0-9]*"
              value={p.ageInput}
              onChange={e => onChange(i, "ageInput", e.target.value.replace(/\D/g, ""))}
              onBlur={() => onAgeBlur(i)}
              placeholder="e.g. 28" className="h-10 min-w-0" required
            />
          </div>
          <div>
            <Label htmlFor={`gender-${i}`} className="mb-1 block text-sm">
              Gender <span className="text-red-500">*</span>
            </Label>
            <select
              id={`gender-${i}`} value={p.gender}
              onChange={e => onChange(i, "gender", e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-brand-700 bg-white min-w-0"
              required
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor={`ticket-${i}`} className="mb-1 block text-sm">Ticket Type</Label>
          <select
            id={`ticket-${i}`} value={p.ticketType}
            onChange={e => onChange(i, "ticketType", e.target.value)}
            className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-brand-700 bg-white"
          >
            <option value="adult">Adult</option>
            <option value="child">Child</option>
            <option value="senior">Senior</option>
          </select>
        </div>
      </div>
    ))}
    {error && (
      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
      </div>
    )}
    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
      <BackButton
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 sm:flex-1"
      />
      <Button onClick={onSubmit} disabled={loading} className="bg-coral-500 hover:bg-coral-600 text-white sm:flex-1">
        {loading
          ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</span>
          : "Continue to Review →"
        }
      </Button>
    </div>
  </div>
);

export default InlinePassengerForm;
