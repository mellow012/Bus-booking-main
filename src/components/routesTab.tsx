import { FC, useState } from 'react';
import { collection, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Route } from '@/types';
import Modal from './Modals';
import { Plus, Edit3, Trash2, Search, MapPin, Clock, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RoutesTabProps {
  routes: Route[];
  setRoutes: React.Dispatch<React.SetStateAction<Route[]>>;
  companyId: string;
  addRoute: (data: any) => Promise<string | null>;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}

const RoutesTab: FC<RoutesTabProps> = ({ routes, setRoutes, companyId, addRoute, setError, setSuccess }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRoute, setEditRoute] = useState<Route | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  const initialNewRoute: Omit<Route, 'id' | 'createdAt' | 'updatedAt'> = { 
    name: '',
    origin: '', 
    destination: '', 
    distance: 0, 
    duration: 0, 
    stops: [], 
    companyId, 
    status: 'active',
    isActive: true
  };
  
  const [newRoute, setNewRoute] = useState(initialNewRoute);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoute.name.trim()) {
      setError('Route name is required');
      return;
    }
    if (newRoute.distance <= 0 || newRoute.duration <= 0) {
      setError('Distance and duration must be positive');
      return;
    }
    const existingRoute = routes.find(r => r.origin === newRoute.origin && r.destination === newRoute.destination);
    if (existingRoute) {
      setError('Route with same origin and destination already exists');
      return;
    }
    setActionLoading(true);
    try {
      const result = await addRoute(newRoute);
      if (result) {
        setNewRoute(initialNewRoute);
        setShowAddModal(false);
        setSuccess('Route added successfully!');
      }
    } catch (err: any) {
      setError(`Failed to add route: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRoute || !editRoute.name.trim() || editRoute.distance <= 0 || editRoute.duration <= 0) {
      setError('Please fill all required fields with valid data');
      return;
    }
    setActionLoading(true);
    try {
      const docRef = doc(db, 'routes', editRoute.id);
      const updatedData = { ...editRoute, updatedAt: new Date() };
      await updateDoc(docRef, updatedData);
      setRoutes(routes.map(r => r.id === editRoute.id ? updatedData : r));
      setShowEditModal(false);
      setEditRoute(null);
      setSuccess('Route updated successfully!');
    } catch (err: any) {
      setError(`Failed to update route: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this route?')) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'routes', id));
      setRoutes(routes.filter(r => r.id !== id));
      setSuccess('Route deleted successfully!');
    } catch (err: any) {
      setError(`Failed to delete route: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRoutes = routes.filter(r => 
    r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.stops.some(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Routes Management</h2>
          <p className="text-sm text-gray-500 mt-1">Manage your bus routes and stops</p>
        </div>
        <Button 
          onClick={() => {
            setNewRoute(initialNewRoute);
            setShowAddModal(true);
          }} 
          className="bg-blue-600 text-white hover:bg-blue-700"
          disabled={actionLoading}
        >
          <Plus className="w-4 h-4 mr-2" /> Add Route
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search routes by name, origin, destination, or stops..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span className="flex items-center">
              <Navigation className="w-4 h-4 mr-1" />
              {routes.length} Total
            </span>
            <span className="flex items-center">
              <MapPin className="w-4 h-4 mr-1" />
              {routes.filter(r => r.isActive).length} Active
            </span>
          </div>
        </div>

        {filteredRoutes.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Navigation className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {routes.length === 0 ? 'No routes yet' : 'No routes match your search'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm 
                ? 'Try adjusting your search terms' 
                : 'Add your first route to start managing your network'}
            </p>
            {routes.length === 0 && (
              <Button 
                onClick={() => {
                  setNewRoute(initialNewRoute);
                  setShowAddModal(true);
                }} 
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" /> Add First Route
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Route Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Origin</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Destination</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Distance</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Duration</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Stops</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoutes.map(route => (
                  <tr key={route.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <Navigation className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="font-medium text-gray-900">{route.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 text-green-500 mr-2" />
                        <span className="text-gray-900">{route.origin}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 text-red-500 mr-2" />
                        <span className="text-gray-900">{route.destination}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-900">{route.distance} km</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-gray-900">
                          {Math.floor(route.duration / 60)}h {route.duration % 60}m
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm text-gray-900">
                        {route.stops.length > 0 ? (
                          <span>{route.stops.length} stops</span>
                        ) : (
                          <span className="text-gray-400">None</span>
                        )}
                      </div>
                      {route.stops.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {route.stops.map(s => s.name).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        route.isActive 
                          ? 'bg-green-100 text-green-800 border border-green-200' 
                          : 'bg-gray-100 text-gray-800 border border-gray-200'
                      }`}>
                        {route.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => { 
                            setEditRoute(route); 
                            setShowEditModal(true); 
                          }} 
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                          disabled={actionLoading}
                          title="Edit route"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(route.id)} 
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                          disabled={actionLoading}
                          title="Delete route"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Route">
        <form onSubmit={handleAdd} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Route Name *</label>
            <input
              type="text"
              value={newRoute.name}
              onChange={e => setNewRoute({ ...newRoute, name: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Blantyre to Lilongwe Express"
              required
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Origin *</label>
              <input
                type="text"
                value={newRoute.origin}
                onChange={e => setNewRoute({ ...newRoute, origin: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Blantyre"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Destination *</label>
              <input
                type="text"
                value={newRoute.destination}
                onChange={e => setNewRoute({ ...newRoute, destination: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Lilongwe"
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Distance (km) *</label>
              <input
                type="number"
                value={newRoute.distance || ''}
                onChange={e => setNewRoute({ ...newRoute, distance: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                required
                min="1"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes) *</label>
              <input
                type="number"
                value={newRoute.duration || ''}
                onChange={e => setNewRoute({ ...newRoute, duration: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                required
                min="1"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stops <span className="text-gray-500 font-normal">(comma-separated, optional)</span>
            </label>
            <input
              type="text"
              value={newRoute.stops.map(s => s.name).join(',')}
              onChange={e => setNewRoute({ 
                ...newRoute, 
                stops: e.target.value.split(',')
                  .map(name => name.trim())
                  .filter(name => name.length > 0)
                  .map((name, idx) => ({ 
                    id: `stop-${idx}`, 
                    name, 
                    order: idx, 
                    distanceFromOrigin: 0 
                  })) 
              })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Zomba, Balaka, Ntcheu"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter stop names separated by commas
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button 
              type="button" 
              onClick={() => setShowAddModal(false)} 
              variant="outline" 
              className="bg-gray-100 hover:bg-gray-200"
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={actionLoading} 
              className="bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {actionLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Route
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Route">
        {editRoute && (
          <form onSubmit={handleEdit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Route Name *</label>
              <input
                type="text"
                value={editRoute.name}
                onChange={e => setEditRoute({ ...editRoute, name: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Origin *</label>
                <input
                  type="text"
                  value={editRoute.origin}
                  onChange={e => setEditRoute({ ...editRoute, origin: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Destination *</label>
                <input
                  type="text"
                  value={editRoute.destination}
                  onChange={e => setEditRoute({ ...editRoute, destination: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Distance (km) *</label>
                <input
                  type="number"
                  value={editRoute.distance}
                  onChange={e => setEditRoute({ ...editRoute, distance: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min="1"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes) *</label>
                <input
                  type="number"
                  value={editRoute.duration}
                  onChange={e => setEditRoute({ ...editRoute, duration: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min="1"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stops <span className="text-gray-500 font-normal">(comma-separated, optional)</span>
              </label>
              <input
                type="text"
                value={editRoute.stops.map(s => s.name).join(',')}
                onChange={e => setEditRoute({ 
                  ...editRoute, 
                  stops: e.target.value.split(',')
                    .map(name => name.trim())
                    .filter(name => name.length > 0)
                    .map((name, idx) => ({ 
                      id: `stop-${idx}`, 
                      name, 
                      order: idx, 
                      distanceFromOrigin: 0 
                    })) 
                })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t">
              <Button 
                type="button" 
                onClick={() => {
                  setShowEditModal(false);
                  setEditRoute(null);
                }} 
                variant="outline" 
                className="bg-gray-100 hover:bg-gray-200"
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={actionLoading} 
                className="bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Update Route
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default RoutesTab;