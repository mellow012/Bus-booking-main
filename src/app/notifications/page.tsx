import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebaseConfig';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { Bell } from 'lucide-react';
import { Notification } from '@/types';

interface NotificationsProps {
  userId: string;
}

const Notifications: React.FC<NotificationsProps> = ({ userId }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
    });
    return () => unsub();
  }, [userId]);

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { isRead: true });
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="relative">
      <button
        className="relative"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-600 text-white rounded-full px-2 text-xs">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white shadow-lg rounded-lg z-50 border">
          <div className="p-4 border-b font-semibold">Notifications</div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && (
              <div className="p-4 text-gray-500">No notifications</div>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 border-b last:border-b-0 ${n.isRead ? 'bg-gray-50' : 'bg-blue-50'}`}
              >
                <div className="font-bold">{n.title}</div>
                <div className="text-sm">{n.message}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
                {!n.isRead && (
                      <button
                    className="mt-2 text-blue-600 text-xs underline"
                    onClick={() => markAsRead(n.id)}
                  >
                    Mark as read
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
