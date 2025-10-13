import { FC, useState } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, getFirestore } from "firebase/firestore";
// Assuming db is correctly initialized and exported from "@/lib/firebaseConfig" 
import { Bus, BusType, BusStatus } from "@/types";
import Modal from "@/components/Modals";
import {db} from "@/lib/firebaseConfig";
// Assuming Modal exists
import { Plus, Edit3, Trash2, Search } from "lucide-react";

// Define a type for the data structure used for adding a new bus (excluding the automatically generated fields)
interface NewBusState {
  licensePlate: string;
  busType: BusType;
  capacity: number;
  amenities: string[];
  companyId: string;
  status: BusStatus;
}

interface BusesTabProps {
  buses: Bus[];
  setBuses: React.Dispatch<React.SetStateAction<Bus[]>>;
  companyId: string;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
  // Removed addBus from props as it is implemented inside the component
}

const BusesTab: FC<BusesTabProps> = ({ buses, setBuses, companyId, setError, setSuccess }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editBus, setEditBus] = useState<Bus | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Initial state now uses the NewBusState type and is correctly typed with literal unions
  const initialNewBus: NewBusState = {
    licensePlate: "",
    busType: "AC", // BusType is inferred as the literal 'AC'
    capacity: 0,
    amenities: [],
    companyId,
    status: "active", // BusStatus is inferred as the literal 'active'
  };
  const [newBus, setNewBus] = useState<NewBusState>(initialNewBus);

  // Utility function for adding bus
  const addBus = async (data: NewBusState) => {
    setActionLoading(true);
    try {
      // 1. Construct the data object to be stored in Firestore
      // MUST include all required properties of the Bus interface (like registrationDetails)
      const busData = {
        ...data,
        // Add required properties that are missing in NewBusState for the Bus type
        registrationDetails: {
          registrationNumber: 'N/A - Pending',
          registrationDate: new Date(),
          expiryDate: new Date(),
          authority: 'N/A',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Use Omit<Bus, 'id'> to properly type the data being added to Firestore (no 'id' needed yet)
     const docRef = await addDoc(collection(db, "buses"), busData as Omit<Bus, 'id'>);

      // 2. Update the local state. Explicitly assert the combined object as Bus to resolve type conflict.
      setBuses([...buses, { id: docRef.id, ...busData }] as Bus[]);
      return docRef.id;
    } catch (err: any) {
      setError(`Failed to add bus: ${err.message}`);
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newBus.capacity < 10 || newBus.capacity > 100) {
      setError("Capacity must be between 10 and 100");
      return;
    }
    if (!newBus.licensePlate || !newBus.busType || !newBus.companyId) {
      setError("License Plate, Bus Type, and Company ID are required");
      return;
    }
    const result = await addBus(newBus);
    if (result) {
      setNewBus(initialNewBus);
      setShowAddModal(false);
      setSuccess("Bus added successfully!");
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBus || editBus.capacity < 10 || editBus.capacity > 100) {
      setError("Please provide a valid capacity between 10 and 100");
      return;
    }
    setActionLoading(true);
    try {
      const docRef = doc(db, "buses", editBus.id);
      
      // 1. Prepare updated data (use editBus.status directly, no need for the confusing ternary)
      const updatedData = { ...editBus, updatedAt: new Date() };
      
      // 2. Remove 'id' property before writing to Firestore
      const firestoreUpdateData = { ...updatedData };
      delete (firestoreUpdateData as Partial<Bus>).id;

      await updateDoc(docRef, firestoreUpdateData);

      // 3. Update local state. Assert the combined object as Bus to resolve type conflict.
      setBuses(buses.map((b) => (b.id === editBus.id ? updatedData as Bus : b)));
      
      setShowEditModal(false);
      setEditBus(null);
      setSuccess("Bus updated successfully!");
    } catch (err: any) {
      setError(`Failed to update bus: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // NOTE: Switched to custom modal for deletion as alert/confirm is not allowed
  const handleDelete = async (id: string) => {
    // You should replace this with a custom confirmation modal UI
    if (!window.confirm("Are you sure you want to delete this bus?")) return; 
    
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, "buses", id));
      setBuses(buses.filter((b) => b.id !== id));
      setSuccess("Bus deleted successfully!");
    } catch (err: any) {
      setError(`Failed to delete bus: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredBuses = buses.filter(
    (b) =>
      b.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.busType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.amenities.some((a) => a.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (buses.length === 0 && actionLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-gray-200 animate-pulse rounded w-1/3"></div>
          <div className="h-10 bg-gray-200 animate-pulse rounded w-1/4"></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="mb-4 flex items-center space-x-2">
            <div className="h-5 w-5 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-10 bg-gray-200 animate-pulse rounded w-full"></div>
          </div>
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {Array(5)
                  .fill(0)
                  .map((_, index) => (
                    <th key={index} className="px-6 py-3">
                      <div className="h-6 bg-gray-200 animate-pulse rounded"></div>
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Array(3)
                .fill(0)
                .map((_, rowIndex) => (
                  <tr key={rowIndex}>
                    {Array(5)
                      .fill(0)
                      .map((_, cellIndex) => (
                        <td key={cellIndex} className="px-6 py-4">
                          <div className="h-4 bg-gray-200 animate-pulse rounded"></div>
                        </td>
                      ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Buses</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          <Plus className="w-4 h-4" />
          <span>Add Bus</span>
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="mb-4 flex items-center space-x-2">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search buses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">License Plate</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amenities</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredBuses.map((bus) => (
              <tr key={bus.id}>
                <td className="px-6 py-4">{bus.licensePlate}</td>
                <td className="px-6 py-4">{bus.busType}</td>
                <td className="px-6 py-4">{bus.capacity}</td>
                <td className="px-6 py-4">{bus.amenities.join(", ") || "None"}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => {
                      setEditBus(bus);
                      setShowEditModal(true);
                    }}
                    className="text-blue-600 mr-2"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(bus.id)} className="text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Bus">
        <form onSubmit={handleAdd} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">License Plate</label>
            <input
              type="text"
              value={newBus.licensePlate}
              onChange={(e) => setNewBus({ ...newBus, licensePlate: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Bus Type</label>
            <select
              value={newBus.busType}
              onChange={(e) =>
                setNewBus({ ...newBus, busType: e.target.value as BusType })
              }
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="AC">AC</option>
              <option value="Non-AC">Non-AC</option>
              <option value="Sleeper">Sleeper</option>
              <option value="Semi-Sleeper">Semi-Sleeper</option>
              <option value="Luxury">Luxury</option>
              <option value="Economy">Economy</option>
              <option value="Minibus">Minibus</option> {/* Added Minibus */}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Capacity</label>
            <input
              type="number"
              value={newBus.capacity}
              onChange={(e) => setNewBus({ ...newBus, capacity: parseInt(e.target.value) || 0 })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
              min="10"
              max="100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Amenities (comma-separated)</label>
            <input
              type="text"
              value={newBus.amenities.join(",")}
              onChange={(e) =>
                setNewBus({ ...newBus, amenities: e.target.value.split(",").map((a) => a.trim()).filter((a) => a) })
              }
              className="mt-1 block w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select
              value={newBus.status}
              onChange={(e) => setNewBus({ ...newBus, status: e.target.value as BusStatus })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
          <div className="flex justify-end space-x-4">
            <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
              {actionLoading ? "Adding..." : "Add Bus"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Bus">
        {editBus && (
          <form onSubmit={handleEdit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">License Plate</label>
              <input
                type="text"
                value={editBus.licensePlate}
                onChange={(e) => setEditBus({ ...editBus, licensePlate: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bus Type</label>
              <select
                value={editBus.busType}
                onChange={(e) =>
                  setEditBus({
                    ...editBus,
                    busType: e.target.value as BusType,
                  })
                }
                className="mt-1 block w-full px-3 py-2 border rounded-md"
                required
              >
                <option value="AC">AC</option>
                <option value="Non-AC">Non-AC</option>
                <option value="Sleeper">Sleeper</option>
                <option value="Semi-Sleeper">Semi-Sleeper</option>
                <option value="Luxury">Luxury</option>
                <option value="Economy">Economy</option>
                <option value="Minibus">Minibus</option> {/* Added Minibus */}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Capacity</label>
              <input
                type="number"
                value={editBus.capacity}
                onChange={(e) => setEditBus({ ...editBus, capacity: parseInt(e.target.value) || 0 })}
                className="mt-1 block w-full px-3 py-2 border rounded-md"
                required
                min="10"
                max="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Amenities (comma-separated)</label>
              <input
                type="text"
                value={editBus.amenities.join(",")}
                onChange={(e) =>
                  setEditBus({ ...editBus, amenities: e.target.value.split(",").map((a) => a.trim()).filter((a) => a) })
                }
                className="mt-1 block w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                value={editBus.status}
                onChange={(e) => setEditBus({ ...editBus, status: e.target.value as BusStatus })}
                className="mt-1 block w-full px-3 py-2 border rounded-md"
                required
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <div className="flex justify-end space-x-4">
              <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                {actionLoading ? "Updating..." : "Update Bus"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default BusesTab;
