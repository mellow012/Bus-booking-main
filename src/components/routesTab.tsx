import { FC, useState } from 'react';
import { collection, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Route } from '@/types';
import Modal from './Modals';
import { Plus, Edit3, Trash2, Search } from 'lucide-react';
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
  const initialNewRoute = { origin: '', destination: '', distance: 0, duration: 0, stops: [], companyId, isActive: true, createdAt: new Date(), updatedAt: new Date() };
  const [newRoute, setNewRoute] = useState(initialNewRoute);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoute.distance <= 0 || newRoute.duration <= 0) {
      setError('Distance and duration must be positive');
      return;
    }
    const existingRoute = routes.find(r => r.origin === newRoute.origin && r.destination === newRoute.destination);
    if (existingRoute) {
      setError('Route already exists');
      return;
    }
    const result = await addRoute(newRoute);
    if (result) {
      setNewRoute(initialNewRoute);
      setShowAddModal(false);
      setSuccess('Route added successfully!');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRoute || editRoute.distance <= 0 || editRoute.duration <= 0) {
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
    r.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.stops.some(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Routes Management</h2>
          <p className="text-gray-600 mt-1">Manage your bus routes</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="bg-blue-600 text-white hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Add Route
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search routes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {filteredRoutes.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No routes found</h3>
            <p className="text-gray-500 mb-6">
              {searchTerm ? 'Try adjusting your search terms' : 'Add your first route to start managing your network'}
            </p>
            <Button onClick={() => setShowAddModal(true)} className="bg-blue-600 text-white hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Add First Route
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Distance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stops</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRoutes.map(route => (
                  <tr key={route.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">{route.origin}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{route.destination}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{route.distance} km</td>
                    <td className="px-6 py-4 whitespace-nowrap">{Math.floor(route.duration / 60)}h {route.duration % 60}m</td>
                    <td className="px-6 py-4 whitespace-nowrap">{route.stops.map(s => s.name).join(', ') || 'None'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Button variant="ghost" onClick={() => { setEditRoute(route); setShowEditModal(true); }} className="text-blue-600 hover:bg-blue-50">
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" onClick={() => handleDelete(route.id)} className="text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Route">
        <form onSubmit={handleAdd} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Origin</label>
            <input
              type="text"
              value={newRoute.origin}
              onChange={e => setNewRoute({ ...newRoute, origin: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Destination</label>
            <input
              type="text"
              value={newRoute.destination}
              onChange={e => setNewRoute({ ...newRoute, destination: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Distance (km)</label>
            <input
              type="number"
              value={newRoute.distance}
              onChange={e => setNewRoute({ ...newRoute, distance: parseFloat(e.target.value) || 0 })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
            <input
              type="number"
              value={newRoute.duration}
              onChange={e => setNewRoute({ ...newRoute, duration: parseInt(e.target.value) || 0 })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Stops (comma-separated)</label>
            <input
              type="text"
              value={newRoute.stops.map(s => s.name).join(',')}
              onChange={e => setNewRoute({ ...newRoute, stops: e.target.value.split(',').map((name, idx) => ({ id: `${idx}`, name: name.trim(), order: idx, distanceFromOrigin: 0 })) })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button type="button" onClick={() => setShowAddModal(false)} variant="outline" className="bg-gray-100 hover:bg-gray-200">
              Cancel
            </Button>
            <Button type="submit" disabled={actionLoading} className="bg-blue-600 text-white hover:bg-blue-700">
              {actionLoading ? 'Adding...' : 'Add Route'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Route">
        {editRoute && (
          <form onSubmit={handleEdit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Origin</label>
              <input
                type="text"
                value={editRoute.origin}
                onChange={e => setEditRoute({ ...editRoute, origin: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Destination</label>
              <input
                type="text"
                value={editRoute.destination}
                onChange={e => setEditRoute({ ...editRoute, destination: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Distance (km)</label>
              <input
                type="number"
                value={editRoute.distance}
                onChange={e => setEditRoute({ ...editRoute, distance: parseFloat(e.target.value) || 0 })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
              <input
                type="number"
                value={editRoute.duration}
                onChange={e => setEditRoute({ ...editRoute, duration: parseInt(e.target.value) || 0 })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Stops (comma-separated)</label>
              <input
                type="text"
                value={editRoute.stops.map(s => s.name).join(',')}
                onChange={e => setEditRoute({ ...editRoute, stops: e.target.value.split(',').map((name, idx) => ({ id: `${idx}`, name: name.trim(), order: idx, distanceFromOrigin: 0 })) })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-6 border-t">
              <Button type="button" onClick={() => setShowEditModal(false)} variant="outline" className="bg-gray-100 hover:bg-gray-200">
                Cancel
              </Button>
              <Button type="submit" disabled={actionLoading} className="bg-blue-600 text-white hover:bg-blue-700">
                {actionLoading ? 'Updating...' : 'Update Route'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default RoutesTab;