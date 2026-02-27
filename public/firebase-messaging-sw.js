// Firebase Cloud Messaging Service Worker
// Handles notifications when app is closed/in background

importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

// Initialize Firebase in Service Worker
const firebaseConfig = {
  apiKey: 'AIzaSyC2M-Mz0JdTXKUFZIoKEhk_pEHlE9zAY0k',
  authDomain: 'busbookingapp.firebaseapp.com',
  projectId: 'busbookingapp',
  storageBucket: 'busbookingapp.appspot.com',
  messagingSenderId: '936031509967',
  appId: '1:936031509967:web:8dd2c4b5e1e44f79a8c57e',
};

firebase.initializeApp(firebaseConfig);

// Get messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw] Received background message:', payload);

  const notificationTitle = payload.notification.title || 'Bus Booking';
  const notificationOptions = {
    body: payload.notification.body || 'You have a new message',
    icon: payload.notification.image || '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'fcm-notification',
    data: payload.data || {},
    actions: [
      {
        action: 'open',
        title: 'Open',
      },
      {
        action: 'close',
        title: 'Close',
      },
    ],
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw] Notification clicked:', event.notification);

  event.notification.close();

  const clickedNotification = event.notification;
  const urlToOpen = clickedNotification.data.link || '/';

  // Look for existing window/tab
  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // Check if there's already a window/tab open with the target URL
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise, open new window/tab with the target URL
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[firebase-messaging-sw] Notification closed:', event.notification);
});

// Handle service worker updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[firebase-messaging-sw] Service Worker initialized');
