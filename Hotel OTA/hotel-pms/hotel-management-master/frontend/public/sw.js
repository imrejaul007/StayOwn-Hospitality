const CACHE_NAME = 'hotel-management-v1.4.0';
const OFFLINE_URL = '/offline.html';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/static/js/bundle.js',
  '/static/css/main.css',
  // Add more critical assets
];

// API routes that can work offline
const OFFLINE_API_ROUTES = [
  '/api/housekeeping/my-tasks',
  '/api/rooms/status',
  '/api/inventory/items',
  '/api/staff/profile'
];

// Background sync tags
const SYNC_TAGS = {
  HOUSEKEEPING_TASK: 'housekeeping-task-sync',
  PHOTO_UPLOAD: 'photo-upload-sync',
  VOICE_NOTE_UPLOAD: 'voice-note-upload-sync',
  TASK_UPDATE: 'task-update-sync',
  INVENTORY_UPDATE: 'inventory-update-sync'
};

self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      console.log('Caching static assets');
      
      try {
        await cache.addAll(STATIC_ASSETS);
      } catch (error) {
        console.error('Failed to cache some assets:', error);
        // Cache individual assets that succeed
        for (const asset of STATIC_ASSETS) {
          try {
            await cache.add(asset);
          } catch (e) {
            console.warn(`Failed to cache ${asset}:`, e);
          }
        }
      }
      
      // Pre-cache offline page
      await cache.add(OFFLINE_URL);
      
      // Skip waiting to activate immediately
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
      
      // Claim all clients immediately
      await clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle different types of requests
  if (request.method === 'GET') {
    if (url.pathname.startsWith('/api/')) {
      // API requests
      event.respondWith(handleApiRequest(request));
    } else {
      // Static assets and pages
      event.respondWith(handleStaticRequest(request));
    }
  } else if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
    // Mutating API requests
    event.respondWith(handleMutatingRequest(request));
  }
});

// Handle static asset requests (HTML, CSS, JS, images)
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    // Try network first for navigation requests (HTML pages)
    if (request.mode === 'navigate') {
      try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
          // Cache successful responses
          await cache.put(request, networkResponse.clone());
          return networkResponse;
        }
      } catch (error) {
        console.log('Network failed for navigation, trying cache');
      }
      
      // Fall back to cache
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Last resort: offline page
      return cache.match(OFFLINE_URL);
    }
    
    // For other requests, try cache first, then network
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      // If cached, also try to update in background
      fetch(request).then(response => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
      }).catch(() => {
        // Network failed, but we have cache
      });
      
      return cachedResponse;
    }
    
    // Not in cache, try network
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache successful responses
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Static request failed:', error);
    
    // Return cached version or offline page
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    if (request.mode === 'navigate') {
      return cache.match(OFFLINE_URL);
    }
    
    throw error;
  }
}

// Handle API GET requests
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const cache = await caches.open(CACHE_NAME);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache successful API responses that are safe to cache
      if (OFFLINE_API_ROUTES.some(route => url.pathname.startsWith(route))) {
        await cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    }
    throw new Error(`Network response not ok: ${networkResponse.status}`);
  } catch (error) {
    console.log('API network request failed, trying cache:', url.pathname);
    
    // Try cache for offline-capable routes
    if (OFFLINE_API_ROUTES.some(route => url.pathname.startsWith(route))) {
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        console.log('Serving API request from cache');
        return cachedResponse;
      }
    }
    
    // Return appropriate offline response
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'This request requires an internet connection',
        offline: true,
        timestamp: new Date().toISOString()
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

// Handle mutating requests (POST, PUT, PATCH, DELETE)
async function handleMutatingRequest(request) {
  try {
    // Try network first - don't clone unless needed for background sync
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      return networkResponse;
    }
    throw new Error(`Network response not ok: ${networkResponse.status}`);
  } catch (error) {
    console.log('Mutating request failed, queuing for background sync');

    // Only queue for background sync if we can safely clone the request
    try {
      const clonedRequest = request.clone();
      const url = new URL(clonedRequest.url);
      const requestData = {
        url: clonedRequest.url,
        method: clonedRequest.method,
        headers: Object.fromEntries(clonedRequest.headers.entries()),
        body: clonedRequest.method !== 'GET' ? await clonedRequest.text() : null,
        timestamp: new Date().toISOString()
      };

      // Store in IndexedDB for background sync
      await storeForBackgroundSync(requestData, getSyncTag(url.pathname));

      // Return immediate response indicating queued for sync
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Request queued for synchronization when online',
          queued: true,
          timestamp: new Date().toISOString()
        }),
        {
          status: 202,
          statusText: 'Accepted',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (cloneError) {
      console.error('Failed to clone request for background sync:', cloneError);
      // Return network error as-is if we can't queue for sync
      throw error;
    }
  }
}

// Get appropriate sync tag based on URL
function getSyncTag(pathname) {
  if (pathname.includes('/housekeeping/')) {
    if (pathname.includes('/photos/')) return SYNC_TAGS.PHOTO_UPLOAD;
    if (pathname.includes('/voice-notes/')) return SYNC_TAGS.VOICE_NOTE_UPLOAD;
    return SYNC_TAGS.HOUSEKEEPING_TASK;
  }
  if (pathname.includes('/inventory/')) return SYNC_TAGS.INVENTORY_UPDATE;
  return SYNC_TAGS.TASK_UPDATE;
}

// Store request for background sync
async function storeForBackgroundSync(requestData, syncTag) {
  try {
    // Open IndexedDB
    const db = await openIndexedDB();
    const transaction = db.transaction(['sync-queue'], 'readwrite');
    const store = transaction.objectStore('sync-queue');
    
    await store.add({
      ...requestData,
      syncTag,
      id: Date.now() + Math.random(),
      retryCount: 0,
      maxRetries: 3
    });
    
    // Register background sync
    await self.registration.sync.register(syncTag);
    
    console.log(`Stored request for background sync with tag: ${syncTag}`);
  } catch (error) {
    console.error('Failed to store for background sync:', error);
  }
}

// Open IndexedDB for sync queue
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('hotel-management-sync', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('sync-queue')) {
        const store = db.createObjectStore('sync-queue', { keyPath: 'id' });
        store.createIndex('syncTag', 'syncTag', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Background Sync Event
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (Object.values(SYNC_TAGS).includes(event.tag)) {
    event.waitUntil(syncQueuedRequests(event.tag));
  }
});

// Sync queued requests
async function syncQueuedRequests(syncTag) {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction(['sync-queue'], 'readwrite');
    const store = transaction.objectStore('sync-queue');
    const index = store.index('syncTag');
    
    const requests = await index.getAll(syncTag);
    console.log(`Found ${requests.length} requests to sync for tag: ${syncTag}`);
    
    const results = {
      success: 0,
      failed: 0,
      removed: 0
    };
    
    for (const requestData of requests) {
      try {
        // Reconstruct the request
        const request = new Request(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });
        
        // Attempt to sync
        const response = await fetch(request);
        
        if (response.ok) {
          // Success - remove from queue
          await store.delete(requestData.id);
          results.success++;
          results.removed++;
          console.log(`Successfully synced request: ${requestData.url}`);
          
          // Notify clients of successful sync
          await notifyClients({
            type: 'sync-success',
            syncTag,
            url: requestData.url,
            timestamp: new Date().toISOString()
          });
        } else {
          // Failed - increment retry count
          requestData.retryCount = (requestData.retryCount || 0) + 1;
          
          if (requestData.retryCount >= requestData.maxRetries) {
            // Max retries reached - remove from queue
            await store.delete(requestData.id);
            results.removed++;
            console.log(`Max retries reached for: ${requestData.url}`);
            
            await notifyClients({
              type: 'sync-failed',
              syncTag,
              url: requestData.url,
              error: `Max retries (${requestData.maxRetries}) reached`,
              timestamp: new Date().toISOString()
            });
          } else {
            // Update retry count
            await store.put(requestData);
            console.log(`Retry ${requestData.retryCount} failed for: ${requestData.url}`);
          }
          results.failed++;
        }
      } catch (error) {
        console.error(`Error syncing request ${requestData.url}:`, error);
        
        // Increment retry count
        requestData.retryCount = (requestData.retryCount || 0) + 1;
        
        if (requestData.retryCount >= requestData.maxRetries) {
          await store.delete(requestData.id);
          results.removed++;
        } else {
          await store.put(requestData);
        }
        results.failed++;
      }
    }
    
    console.log(`Sync completed for ${syncTag}:`, results);
    
    // Notify clients of sync completion
    await notifyClients({
      type: 'sync-complete',
      syncTag,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error during background sync:', error);
  }
}

// Notify all clients
async function notifyClients(message) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage(message);
  });
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('Push notification received');
  
  let notificationData = {
    title: 'PENTOUZ Hotel',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'general',
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200]
  };
  
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { 
        ...notificationData, 
        ...data,
        // Map notification types to appropriate styling
        icon: getNotificationIcon(data.type),
        requireInteraction: data.priority === 'urgent' || data.priority === 'high',
        vibrate: data.priority === 'urgent' ? [300, 100, 300, 100, 300] : [200, 100, 200]
      };
    } catch (error) {
      console.error('Error parsing push notification data:', error);
    }
  }
  
  // Add action buttons based on notification type
  const actions = getNotificationActions(notificationData.type);
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.message || notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.type || notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      silent: notificationData.silent,
      vibrate: notificationData.vibrate,
      actions: actions,
      data: {
        notificationId: notificationData._id,
        type: notificationData.type,
        actionUrl: notificationData.actionUrl || '/guest/notifications',
        metadata: notificationData.metadata
      }
    })
  );
});

// Get notification icon based on type
function getNotificationIcon(type) {
  const iconMap = {
    'welcome': '/icons/welcome-icon.png',
    'booking_confirmation': '/icons/booking-icon.png',
    'booking_reminder': '/icons/reminder-icon.png',
    'service_reminder': '/icons/service-icon.png',
    'payment_success': '/icons/payment-icon.png',
    'payment_failed': '/icons/error-icon.png',
    'promotional': '/icons/promo-icon.png',
    'system_alert': '/icons/alert-icon.png'
  };
  
  return iconMap[type] || '/icons/icon-192x192.png';
}

// Get notification actions based on type
function getNotificationActions(type) {
  const baseActions = [
    { action: 'view', title: 'View', icon: '/icons/view-icon.png' },
    { action: 'dismiss', title: 'Dismiss', icon: '/icons/dismiss-icon.png' }
  ];
  
  const typeSpecificActions = {
    'booking_reminder': [
      { action: 'view', title: 'View Booking', icon: '/icons/view-icon.png' },
      { action: 'snooze', title: 'Remind Later', icon: '/icons/snooze-icon.png' },
      { action: 'dismiss', title: 'Dismiss', icon: '/icons/dismiss-icon.png' }
    ],
    'service_reminder': [
      { action: 'view', title: 'View Details', icon: '/icons/view-icon.png' },
      { action: 'confirm', title: 'Confirm', icon: '/icons/confirm-icon.png' },
      { action: 'reschedule', title: 'Reschedule', icon: '/icons/reschedule-icon.png' }
    ],
    'promotional': [
      { action: 'view', title: 'View Offer', icon: '/icons/view-icon.png' },
      { action: 'save', title: 'Save Offer', icon: '/icons/save-icon.png' },
      { action: 'dismiss', title: 'Not Interested', icon: '/icons/dismiss-icon.png' }
    ]
  };
  
  return typeSpecificActions[type] || baseActions;
}

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.notification.tag);
  
  event.notification.close();
  
  const clickAction = event.action || 'default';
  const data = event.notification.data || {};
  
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });
      
      // Determine URL to open
      let urlToOpen = '/';
      if (data.url) {
        urlToOpen = data.url;
      } else if (event.notification.tag === 'housekeeping') {
        urlToOpen = '/staff/housekeeping';
      } else if (event.notification.tag === 'maintenance') {
        urlToOpen = '/staff/maintenance';
      }
      
      // If we already have a window open, focus it and navigate
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          await client.focus();
          client.postMessage({
            type: 'notification-click',
            action: clickAction,
            data: data,
            url: urlToOpen
          });
          return;
        }
      }
      
      // No existing window, open a new one
      await self.clients.openWindow(urlToOpen);
    })()
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_NAME });
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(
        (async () => {
          await caches.delete(CACHE_NAME);
          event.ports[0].postMessage({ success: true });
        })()
      );
      break;
      
    case 'FORCE_SYNC':
      if (data.syncTag && Object.values(SYNC_TAGS).includes(data.syncTag)) {
        event.waitUntil(syncQueuedRequests(data.syncTag));
      }
      break;
      
    default:
      console.log('Unknown message type:', type);
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'periodic-sync') {
    event.waitUntil(
      (async () => {
        console.log('Periodic background sync triggered');
        
        // Sync all queued requests
        for (const syncTag of Object.values(SYNC_TAGS)) {
          try {
            await syncQueuedRequests(syncTag);
          } catch (error) {
            console.error(`Error in periodic sync for ${syncTag}:`, error);
          }
        }
        
        // Clean up old cached data
        await cleanupOldCaches();
      })()
    );
  }
});

// Cleanup old cached data
async function cleanupOldCaches() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const cacheDate = response.headers.get('date');
        if (cacheDate) {
          const age = now - new Date(cacheDate).getTime();
          if (age > maxAge) {
            await cache.delete(request);
            console.log('Cleaned up old cache entry:', request.url);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up cache:', error);
  }
}

console.log('Service Worker loaded successfully');