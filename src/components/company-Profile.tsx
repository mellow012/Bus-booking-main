import { FC, useState, useEffect } from "react";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import {
  Building2,
  Edit3,
  Save,
  Camera,
  Loader2,
  Clock,
  MessageCircle,
  Calendar,
  ChevronRight,
  Navigation,
  FileText,
  MapPin,
  Plus,
  X
} from "lucide-react";
import { OperatingHours, Company } from "@/types";
import { Button } from "@/components/ui/button";

interface CompanyProfileTabProps {
  company: Company | null;
  setCompany: React.Dispatch<React.SetStateAction<Company | null>>;
  schedules?: any[];
  routes?: any[];
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}

const DEFAULT_HOURS: Record<string, OperatingHours> = {
  Monday: { open: "08:00", close: "17:00", closed: false },
  Tuesday: { open: "08:00", close: "17:00", closed: false },
  Wednesday: { open: "08:00", close: "17:00", closed: false },
  Thursday: { open: "08:00", close: "17:00", closed: false },
  Friday: { open: "08:00", close: "17:00", closed: false },
  Saturday: { open: "09:00", close: "13:00", closed: false },
  Sunday: { open: "00:00", close: "00:00", closed: true },
};

/**
 * Helper function to safely parse branches from Company data
 * Handles both string and array formats
 */
const parseBranches = (branchesData: any): string[] => {
  if (!branchesData) return [];
  
  // If it's already an array, return it
  if (Array.isArray(branchesData)) {
    return branchesData.filter(b => typeof b === 'string').map(b => b.trim());
  }
  
  // If it's a string, split by comma
  if (typeof branchesData === 'string') {
    return branchesData
      .split(",")
      .map(b => b.trim())
      .filter(b => b.length > 0);
  }
  
  return [];
};

const CompanyProfileTab: FC<CompanyProfileTabProps> = ({ 
  company, 
  setCompany, 
  schedules = [], 
  routes = [],
  setError,
  setSuccess
}) => {
  const { userProfile, refreshUserProfile } = useAuth();
  const router = useRouter();
  
  const [editData, setEditData] = useState<Company | null>(company);
  const [logoPreview, setLogoPreview] = useState<string | null>(company?.logo || null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isInitialSetup, setIsInitialSetup] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newBranch, setNewBranch] = useState("");
  const [branches, setBranches] = useState<string[]>(
    company ? parseBranches(company.branches) : []
  );

  // Logic for live departures
  const todaysSchedules = (schedules || []).filter(s => {
    const sDate = s.departureDateTime instanceof Date 
      ? s.departureDateTime 
      : s.departureDateTime?.toDate?.() || null;
    
    return sDate?.toDateString() === new Date().toDateString();
  });

  useEffect(() => {
    if (userProfile && !userProfile.setupCompleted) {
      setIsInitialSetup(true);
      setIsEditing(true);
      setEditData(company);
    }
  }, [userProfile, company]);

  useEffect(() => {
    if (company?.branches) {
      setBranches(parseBranches(company.branches));
    }
  }, [company?.branches]);

  const handleAddBranch = () => {
    const trimmed = newBranch.trim();
    if (!trimmed) {
      setError("Branch name cannot be empty");
      return;
    }
    if (branches.includes(trimmed)) {
      setError("This branch already exists");
      return;
    }
    setBranches([...branches, trimmed]);
    setNewBranch("");
  };

  const handleRemoveBranch = (branchToRemove: string) => {
    setBranches(branches.filter(b => b !== branchToRemove));
  };

  const handleHoursChange = (day: string, field: keyof OperatingHours, value: any) => {
    setEditData(prev => {
      if (!prev) return prev;
      const currentHours = prev.operatingHours || DEFAULT_HOURS;
      return {
        ...prev,
        operatingHours: {
          ...currentHours,
          [day]: { ...currentHours[day], [field]: value }
        }
      };
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData || !userProfile) return;

    if (branches.length === 0) {
      setError("Please add at least one branch/region");
      return;
    }

    setActionLoading(true);
    try {
      const companyRef = doc(db, "companies", editData.id);
      const now = Timestamp.now();
      
      const payload = {
        ...editData,
        branches: branches.join(", "), // Store as comma-separated string
        updatedAt: now,
        operatingHours: editData.operatingHours || DEFAULT_HOURS
      };

      await updateDoc(companyRef, payload);

      if (isInitialSetup) {
        await updateDoc(doc(db, "users", userProfile.id), {
          setupCompleted: true,
          updatedAt: now
        });
      }

      setCompany({ ...payload, updatedAt: now.toDate() } as any);
      setSuccess("Profile updated successfully!");
      setIsEditing(false);
      
      if (isInitialSetup) {
        await refreshUserProfile();
        router.push("/company/admin");
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to update profile");
    } finally {
      setActionLoading(false);
    }
  };

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Loader2 className="animate-spin mb-4" size={40} />
        <p className="font-medium">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-8 px-4">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="relative group">
            <div className="w-32 h-32 rounded-3xl bg-white/20 backdrop-blur-xl p-1.5 border border-white/30 shadow-inner">
              <img
                src={logoPreview || company.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(company.name || "C")}&background=random`}
                className="w-full h-full rounded-[1.25rem] object-cover shadow-sm"
                alt="Company Logo"
              />
            </div>
            {isEditing && (
              <label className="absolute -bottom-2 -right-2 bg-white text-blue-600 p-2.5 rounded-2xl shadow-xl cursor-pointer hover:scale-110 transition-transform border border-gray-100">
                <Camera size={20} />
                <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                   const file = e.target.files?.[0];
                   if (file) {
                     const reader = new FileReader();
                     reader.onloadend = () => setLogoPreview(reader.result as string);
                     reader.readAsDataURL(file);
                   }
                }} />
              </label>
            )}
          </div>

          <div className="text-center md:text-left flex-1">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2">{company.name}</h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              <span className="bg-white/20 backdrop-blur-md px-4 py-1 rounded-full text-sm font-bold border border-white/10">
                {company.status || 'Active'}
              </span>
              <span className="bg-blue-400/30 backdrop-blur-md px-4 py-1 rounded-full text-sm font-bold border border-white/10">
                {branches.length} {branches.length === 1 ? 'Branch' : 'Branches'}
              </span>
              <span className="bg-blue-400/30 backdrop-blur-md px-4 py-1 rounded-full text-sm font-bold border border-white/10">
                {routes.length} Active Routes
              </span>
            </div>
          </div>

          {!isEditing && (
            <button 
              onClick={() => setIsEditing(true)} 
              className="bg-white text-blue-700 px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-blue-50 transition-all active:scale-95 flex items-center gap-2"
            >
              <Edit3 size={20} /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleUpdate} className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Building2 className="text-blue-500" size={28}/> General Info
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Phone Number</label>
                <input 
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl transition-all outline-none mt-1" 
                  value={editData?.contact || ""} 
                  onChange={e => setEditData(prev => prev ? {...prev, contact: e.target.value} : null)}
                />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Physical Address</label>
                <input 
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl transition-all outline-none mt-1" 
                  value={editData?.address || ""} 
                  onChange={e => setEditData(prev => prev ? {...prev, address: e.target.value} : null)}
                />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Bio</label>
                <textarea 
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl transition-all outline-none h-40 resize-none mt-1" 
                  value={editData?.description || ""}
                  onChange={e => setEditData(prev => prev ? {...prev, description: e.target.value} : null)}
                />
              </div>
            </div>
          </div>

          {/* Branches Section */}
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3 mb-6">
              <MapPin className="text-green-500" size={28}/> Operating Branches
            </h2>
            
            <div className="space-y-4 mb-6">
              <p className="text-sm text-gray-600">
                Add all branches/regions where your company operates. These will be used to assign operators to their respective locations.
              </p>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBranch())}
                  placeholder="e.g., Lilongwe, Blantyre, Mzuzu"
                  className="flex-1 px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-green-500 focus:bg-white rounded-xl transition-all outline-none"
                />
                <Button
                  type="button"
                  onClick={handleAddBranch}
                  className="px-6 bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center gap-2"
                >
                  <Plus size={18} /> Add
                </Button>
              </div>
            </div>

            {branches.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Active Branches ({branches.length})
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {branches.map((branch, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-green-50 border border-green-100 rounded-xl group hover:bg-green-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-green-600" />
                        <span className="font-semibold text-gray-900">{branch}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBranch(branch)}
                        className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded-lg"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <MapPin className="mx-auto text-gray-300 mb-2" size={32} />
                <p className="text-sm text-gray-500 font-medium">No branches added yet</p>
                <p className="text-xs text-gray-400 mt-1">Add your first branch to get started</p>
              </div>
            )}

            <div className="mt-4 p-4 bg-yellow-50 rounded-xl border border-yellow-100">
              <p className="text-xs text-yellow-800">
                <strong>Note:</strong> Operators will be assigned to these branches. Make sure to add all your operating locations.
              </p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 lg:col-span-2">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3 mb-8">
              <Clock className="text-blue-500" size={28}/> Operating Hours
            </h2>
            <div className="space-y-4">
              {Object.keys(DEFAULT_HOURS).map(day => {
                const dayData = editData?.operatingHours?.[day] || DEFAULT_HOURS[day];
                return (
                  <div key={day} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl">
                    <span className="font-bold text-gray-700 w-24">{day}</span>
                    <div className="flex items-center gap-3">
                      {!dayData.closed ? (
                        <div className="flex items-center gap-2">
                          <input type="time" value={dayData.open} onChange={e => handleHoursChange(day, 'open', e.target.value)} className="p-2 border rounded-xl" />
                          <span className="text-gray-300">-</span>
                          <input type="time" value={dayData.close} onChange={e => handleHoursChange(day, 'close', e.target.value)} className="p-2 border rounded-xl" />
                        </div>
                      ) : <span className="text-red-400 font-bold italic">Closed</span>}
                      <button 
                        type="button"
                        onClick={() => handleHoursChange(day, 'closed', !dayData.closed)}
                        className={`text-[10px] font-black px-3 py-2 rounded-xl border-2 ${dayData.closed ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}
                      >
                        {dayData.closed ? 'OPEN' : 'CLOSE'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 flex items-center justify-between bg-blue-50 p-6 rounded-[2rem]">
            <p className="text-blue-700 text-sm font-medium">Changes must be saved to apply.</p>
            <div className="flex gap-4">
              <button type="button" onClick={() => {
                setIsEditing(false);
                setBranches(company ? parseBranches(company.branches) : []);
              }} className="px-8 py-4 font-bold text-gray-500">Cancel</button>
              <button type="submit" disabled={actionLoading} className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-black flex items-center gap-2">
                {actionLoading ? <Loader2 className="animate-spin" /> : <Save size={20}/>} Save Profile
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Branches Display Card */}
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <MapPin className="text-green-600" size={28}/> 
                  Our Branches
                </h3>
                <span className="bg-green-50 text-green-700 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">
                  {branches.length} {branches.length === 1 ? 'Location' : 'Locations'}
                </span>
              </div>

              {branches.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {branches.map((branch, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-4 bg-gradient-to-br from-green-50 to-white rounded-2xl border border-green-100"
                    >
                      <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                        <MapPin size={20} className="text-green-600" />
                      </div>
                      <span className="font-bold text-gray-900">{branch}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100">
                  <MapPin className="mx-auto text-gray-300 mb-4" size={48} />
                  <p className="text-gray-500 font-bold">No branches configured</p>
                  <p className="text-sm text-gray-400 mt-2">Add branches in edit mode</p>
                </div>
              )}
            </div>

            {/* Live Board */}
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold flex items-center gap-3"><Clock className="text-blue-600" size={28}/> Live Today</h3>
                <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full animate-pulse">
                  <div className="w-2 h-2 bg-red-600 rounded-full" />
                  <span className="text-xs font-black uppercase">Live Board</span>
                </div>
              </div>
              <div className="space-y-4">
                {todaysSchedules.length > 0 ? todaysSchedules.map(s => {
                  const route = routes.find(r => r.id === s.routeId);
                  return (
                    <div key={s.id} className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl border border-gray-100 transition-all">
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-2xl font-black text-blue-600">
                            {new Date(s.departureDateTime?.toDate?.() || s.departureDateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </p>
                        </div>
                        <div className="h-10 w-[2px] bg-gray-200" />
                        <div>
                          <p className="font-black text-xl text-gray-900 leading-tight">
                            {route?.origin || route?.departureLocation} <ChevronRight className="inline text-gray-300" size={16}/> {route?.destination || route?.arrivalLocation}
                          </p>
                          <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">{s.busId || 'Coach'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-gray-900">{s.availableSeats}</p>
                        <p className="text-[10px] text-blue-500 font-black uppercase tracking-tighter">Seats Left</p>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-center py-12 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100">
                    <Calendar className="mx-auto text-gray-300 mb-4" size={48} />
                    <p className="text-gray-500 font-bold">No trips on the board for today.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Service Network Section */}
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <Navigation className="text-indigo-600" size={28}/> 
                  Service Network
                </h3>
                <span className="bg-indigo-50 text-indigo-700 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">
                  {routes.length} Active Routes
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {routes.length > 0 ? routes.map((route, index) => {
                  const start = route.origin || route.departureLocation || "Unknown Origin";
                  const end = route.destination || route.arrivalLocation || "Unknown Destination";
                  return (
                    <div key={route.id || index} className="relative overflow-hidden p-7 bg-gradient-to-br from-indigo-50/50 to-white rounded-[2rem] border border-indigo-100 group hover:shadow-xl transition-all">
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Route Details</p>
                            <p className="text-xs font-bold text-gray-400">{route.id?.substring(0, 8)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-3 h-3 rounded-full border-2 border-indigo-600 bg-white" />
                            <div className="w-[2px] h-8 bg-indigo-200 my-1" />
                            <div className="w-3 h-3 rounded-full bg-blue-600" />
                          </div>
                          <div className="flex flex-col gap-5">
                            <p className="font-black text-gray-900 uppercase text-base">{start}</p>
                            <p className="font-black text-gray-900 uppercase text-base">{end}</p>
                          </div>
                        </div>
                        <div className="mt-8 pt-5 border-t border-indigo-50 flex justify-between items-center">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Est. Trip</span>
                          <span className="text-sm font-black text-indigo-700">{route.duration || "N/A"}</span>
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="col-span-2 py-10 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-400 font-bold">No routes available.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {company.contact && (
              <a href={`https://wa.me/${company.contact.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="block group">
                <div className="bg-green-500 rounded-[2rem] p-8 text-white shadow-xl hover:-translate-y-1 transition-all flex items-center gap-6">
                  <div className="p-4 bg-white/20 rounded-2xl"><MessageCircle size={32} /></div>
                  <div>
                    <p className="font-black text-2xl">WhatsApp</p>
                    <p className="text-sm opacity-80 uppercase font-bold tracking-widest">Direct Line</p>
                  </div>
                </div>
              </a>
            )}

            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-900"><Clock size={22} className="text-blue-600"/> Terminal Hours</h3>
              <div className="space-y-4">
                {Object.keys(DEFAULT_HOURS).map(day => {
                  const hours = company.operatingHours?.[day] || DEFAULT_HOURS[day];
                  return (
                    <div key={day} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0">
                      <span className="text-gray-400 font-bold uppercase text-[10px]">{day}</span>
                      <span className={`font-black ${hours.closed ? 'text-red-400' : 'text-gray-900'}`}>
                        {hours.closed ? 'Closed' : `${hours.open} - ${hours.close}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-blue-600 rounded-[2rem] p-8 text-white shadow-xl shadow-blue-100">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><FileText size={22} /> Our Story</h3>
              <p className="text-sm italic text-blue-100">"{company.description || "Reliable travel services."}"</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyProfileTab;