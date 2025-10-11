import { FC, useState, ChangeEvent, useEffect } from "react";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
// NOTE: Assuming db, Company, useAuth, and useRouter are imported correctly elsewhere in the actual project structure.
// For the purpose of this single file, we will comment out or stub non-provided imports.
 import { db } from "@/lib/firebaseConfig"; // Assuming a valid Firebase setup
 //import { Company } from "@/types"; // Assuming this type is defined
 import { useAuth } from "@/contexts/AuthContext";
 import { useRouter } from "next/navigation";

// --- Mocking necessary types/imports for file completeness in this environment ---
interface Company {
    id: string;
    name: string;
    email: string;
    ownerId: string;
    contact: string; // Used for phone in the component
    status: "active" | "pending" | "inactive";
    createdAt: Date;
    updatedAt: Date; // The critical type: Date
    address?: string;
    description?: string;
    logo?: string;
    paymentSettings?: {
        gateways?: {
            paychangu?: boolean;
            stripe?: boolean;
        };
    };
}
// Placeholder for Timestamp - since we can't import Timestamp from firebase/firestore here
// We'll trust the user's environment handles the real import.
// const Timestamp = {
//   now: () => ({ toDate: () => new Date(), fakeTimestamp: true }),
// };

// -------------------------------------------------------------------------------


import {
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Edit3,
  Save,
  Camera,
  Loader2,
  CheckCircle,
  X,
  AlertCircle,
} from "lucide-react";

interface CompanyProfileTabProps {
  company: Company | null;
  setCompany: React.Dispatch<React.SetStateAction<Company | null>>;
}

const CompanyProfileTab: FC<CompanyProfileTabProps> = ({ company, setCompany }) => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const router = useRouter();
  // Using the Company type for state here is slightly incorrect since Firestore data uses Timestamp,
  // but we'll stick to the user's setup and ensure we convert Timestamp to Date when setting state.
  const [editData, setEditData] = useState<Company | null>(company);
  const [logoPreview, setLogoPreview] = useState<string | null>(company?.logo || null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isInitialSetup, setIsInitialSetup] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string>("");

  useEffect(() => {
    if (userProfile && !userProfile.setupCompleted) {
      setIsInitialSetup(true);
      setIsEditing(true);
      setEditData(company || null);
    } else if (userProfile?.setupCompleted) {
      setIsInitialSetup(false);
    }
  }, [userProfile, company]);

  const validateField = (field: string, value: string): string => {
    switch (field) {
      case "name":
        return !value.trim() ? "Company name is required" : "";
      case "email":
        return !value.trim() || !value.includes("@") ? "Valid email is required" : "";
      case "phone": // Maps to 'contact' field
        const phoneRegex = /^\+265[0-9]{9}$/;
        return !phoneRegex.test(value.replace(/[\s-]/g, ""))
          ? "Phone must be in +265 format (e.g., +265123456789)"
          : "";
      case "address":
        return !value.trim() ? "Address is required" : "";
      case "description":
        return isInitialSetup && !value?.trim() ? "Description is required for initial setup" : "";
      default:
        return "";
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    if (!editData) return;

    setEditData((prev) => (prev ? { ...prev, [field]: value } : prev));

    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setErrors((prev) => ({ ...prev, general: "Please upload a valid image (JPEG, PNG, or WebP)" }));
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, general: "Image size must be less than 2MB" }));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        setLogoPreview(base64String);
        setEditData((prev) => (prev ? { ...prev, logo: base64String } : prev));
      };
      reader.onerror = () => setErrors((prev) => ({ ...prev, general: "Failed to read image file" }));
      reader.readAsDataURL(file);
    }
  };

  const validateForm = (): boolean => {
    if (!editData) return false;

    const newErrors: Record<string, string> = {};
    const fields = ["name", "email", "contact", "address", "description"]; // Note: using 'contact' here which maps to 'phone' validation

    fields.forEach((field) => {
        // Need to explicitly check if the key is 'contact' to use the 'phone' validator
        const value = editData[field as keyof Company] as string || "";
        const validationKey = field === 'contact' ? 'phone' : field;
        const error = validateField(validationKey, value);
        if (error) newErrors[field] = error;
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editData || !user || !userProfile) {
      setErrors((prev) => ({ ...prev, general: "User authentication required" }));
      return;
    }

    if (!validateForm()) {
      setErrors((prev) => ({ ...prev, general: "Please correct the highlighted errors" }));
      return;
    }

    setActionLoading(true);
    setErrors({});
    setSuccess("");

    try {
      const companyRef = doc(db, "companies", editData.id);
      const userRef = doc(db, "users", userProfile.id);
      
      // 1. Create the Timestamp for both database and state consistency
      const firestoreUpdateTimestamp = Timestamp.now();
      
      // 2. Data payload for Firestore (uses Timestamp, which Firestore expects)
      const firestorePayload = {
        ...(editData as Company), // We checked for null earlier, safe to cast
        updatedAt: firestoreUpdateTimestamp,
      };

      // Firestore update
      await updateDoc(companyRef, firestorePayload);

      if (isInitialSetup) {
        await updateDoc(userRef, {
          setupCompleted: true,
          updatedAt: Timestamp.now(),
        });
      }

      // 3. Data payload for React State (uses Date, which the 'Company' type expects)
      const clientStateUpdate: Company = {
        ...(editData as Company), // The original data structure
        // FIX: Convert the Timestamp back to a native Date object 
        // before setting it on the React state.
        updatedAt: firestoreUpdateTimestamp.toDate(), 
      };

      setCompany(clientStateUpdate); // NO ERROR HERE!
      
      setIsEditing(false);
      setEditData(null);
      setSuccess("Company profile updated successfully!");

      if (isInitialSetup) {
        await refreshUserProfile();
        router.push("/company/admin");
      }
    } catch (err: any) {
      console.error("Update error:", err);
      setErrors((prev) => ({ ...prev, general: `Failed to update profile: ${err.message || "Network error occurred"}` }));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData(company);
    setLogoPreview(company?.logo || null);
    setErrors({});
    setSuccess("");
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditData(company);
    setLogoPreview(company?.logo || null);
  };

  if (!company && actionLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 mb-8 text-white relative overflow-hidden animate-pulse">
          <div className="h-24 w-24 bg-gray-200 rounded-xl mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {Array(4)
            .fill(0)
            .map((_, index) => (
              <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="h-6 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          <div className="lg:col-span-3 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="h-6 bg-gray-200 rounded mb-2"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <Building2 size={48} className="mb-4 text-gray-300" />
        <h3 className="text-lg font-medium mb-2">No Company Data</h3>
        <p className="text-sm">Company information is not available at this time.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 mb-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-sm p-1">
                <img
                  src={logoPreview || company.logo || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=96&h=96&fit=crop&crop=center"}
                  alt={`${company.name} Logo`}
                  className="w-full h-full rounded-xl object-cover"
                />
              </div>
              {isEditing && (
                <label className="absolute -bottom-2 -right-2 bg-white text-gray-700 p-2 rounded-full shadow-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <Camera size={16} />
                  <input
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                  />
                </label>
              )}
            </div>

            <div>
              <h1 className="text-3xl font-bold mb-2">{company.name}</h1>
              <p className="text-white/80 text-lg">
                {isInitialSetup ? "Complete your company setup" : "Company Profile"}
              </p>
            </div>
          </div>

          {!isInitialSetup && !isEditing && (
            <button
              onClick={handleStartEdit}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-6 py-3 rounded-xl transition-colors"
            >
              <Edit3 size={18} />
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Content Section */}
      {isEditing ? (
        <form onSubmit={handleUpdate} className="space-y-8">
          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
            >
              <X size={18} />
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {isInitialSetup ? "Complete Setup" : "Save Changes"}
            </button>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Basic Information */}
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Building2 size={20} className="text-blue-600" />
                Basic Information
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                  <input
                    type="text"
                    value={editData?.name || ""}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border-2 transition-colors focus:outline-none ${
                      errors.name ? "border-red-300 focus:border-red-500" : "border-gray-200 focus:border-blue-500"
                    }`}
                    placeholder="Enter company name"
                    disabled={!isInitialSetup}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle size={14} />
                      {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={editData?.email || ""}
                    onChange={(e) => handleFieldChange("email", e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border-2 transition-colors focus:outline-none ${
                      errors.email ? "border-red-300 focus:border-red-500" : "border-gray-200 focus:border-blue-500"
                    }`}
                    placeholder="company@example.com"
                    disabled={!isInitialSetup}
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle size={14} />
                      {errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={editData?.contact || ""}
                    onChange={(e) => handleFieldChange("contact", e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border-2 transition-colors focus:outline-none ${
                      errors.contact ? "border-red-300 focus:border-red-500" : "border-gray-200 focus:border-blue-500"
                    }`}
                    placeholder="+265123456789"
                    disabled={!isInitialSetup}
                  />
                  {/* Note: changed from errors.phone to errors.contact for consistency */}
                  {errors.contact && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle size={14} />
                      {errors.contact}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <input
                    type="text"
                    value={editData?.address || ""}
                    onChange={(e) => handleFieldChange("address", e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border-2 transition-colors focus:outline-none ${
                      errors.address ? "border-red-300 focus:border-red-500" : "border-gray-200 focus:border-blue-500"
                    }`}
                    placeholder="Enter company address"
                    disabled={!isInitialSetup}
                  />
                  {errors.address && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle size={14} />
                      {errors.address}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <FileText size={20} className="text-green-600" />
                About Company
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={editData?.description || ""}
                  onChange={(e) => handleFieldChange("description", e.target.value)}
                  rows={8}
                  className={`w-full px-4 py-3 rounded-xl border-2 transition-colors focus:outline-none resize-none ${
                    errors.description ? "border-red-300 focus:border-red-500" : "border-gray-200 focus:border-blue-500"
                  }`}
                  placeholder="Describe your company, its mission, and what makes it unique..."
                  disabled={!isInitialSetup}
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle size={14} />
                    {errors.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* General Error or Success Messages */}
          {errors.general && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
              <AlertCircle size={20} />
              <span>{errors.general}</span>
            </div>
          )}
          {success && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-700">
              <CheckCircle size={20} />
              <span>{success}</span>
            </div>
          )}
        </form>
      ) : (
        // Display Mode
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Info Cards */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Mail className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Email</h3>
                  <p className="text-sm text-gray-500">Contact email</p>
                </div>
              </div>
              <p className="text-gray-900 font-medium">{company.email}</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-green-100 rounded-xl">
                  <Phone className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Phone</h3>
                  <p className="text-sm text-gray-500">Primary contact</p>
                </div>
              </div>
              <p className="text-gray-900 font-medium">{company.contact}</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow md:col-span-2">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-purple-100 rounded-xl">
                  <MapPin className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Address</h3>
                  <p className="text-sm text-gray-500">Business location</p>
                </div>
              </div>
              <p className="text-gray-900 font-medium">{company.address}</p>
            </div>
          </div>

          {/* Description Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-orange-100 rounded-xl">
                <FileText className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">About</h3>
                <p className="text-sm text-gray-500">Company description</p>
              </div>
            </div>
            <p className="text-gray-700 leading-relaxed">
              {company.description || "No description provided yet."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyProfileTab;
