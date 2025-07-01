/**
 * Makes any HTML page offline-capable with automatic caching
 * @param {string} html - The original HTML content
 * @returns {string} HTML with offline capabilities injected
 */
export function makeOffline(html) {
  // Inject the offline scripts before closing </body> tag
  const offlineScripts = `
    <!-- Offline functionality injected by makeOffline() -->
    <style id="offline-styles">
      .offline-banner {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #f8d7da;
        color: #721c24;
        padding: 10px;
        text-align: center;
        z-index: 10000;
        display: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .offline-banner.show { display: block; }
      .update-banner {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #fff3cd;
        color: #856404;
        padding: 15px;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        display: none;
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .update-banner.show { display: block; }
      .update-banner button {
        background: #007bff;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 3px;
        cursor: pointer;
        margin-left: 10px;
      }
    </style>
    
    <div class="offline-banner" id="offline-banner">
      📱 You're offline! Showing cached content.
    </div>
    
    <div class="update-banner" id="update-banner">
      📱 New version available!
      <button onclick="window.offlineHelper.updateApp()">Update</button>
    </div>

    <script>
      // Offline helper functionality
      window.offlineHelper = {
        isOnline: navigator.onLine,
        serviceWorker: null,
        
        init() {
          this.updateStatus();
          this.registerServiceWorker();
          this.setupEventListeners();
        },
        
        async registerServiceWorker() {
          if ('serviceWorker' in navigator) {
            try {
              const registration = await navigator.serviceWorker.register('/sw.js');
              this.serviceWorker = registration;
              
              registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    this.showUpdateBanner();
                  }
                });
              });
            } catch (err) {
              console.log('SW registration failed:', err);
            }
          }
        },
        
        setupEventListeners() {
          window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateStatus();
          });
          
          window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateStatus();
          });
          
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', event => {
              if (event.data.type === 'CACHE_UPDATED') {
                this.showUpdateBanner();
              }
            });
          }
        },
        
        updateStatus() {
          const banner = document.getElementById('offline-banner');
          if (this.isOnline) {
            banner.classList.remove('show');
          } else {
            banner.classList.add('show');
          }
        },
        
        showUpdateBanner() {
          document.getElementById('update-banner').classList.add('show');
        },
        
        updateApp() {
          if (this.serviceWorker && this.serviceWorker.waiting) {
            this.serviceWorker.waiting.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          }
        }
      };
      
      // Initialize when DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.offlineHelper.init());
      } else {
        window.offlineHelper.init();
      }
    </script>
  `;

  // Insert before closing </body> tag, or at the end if no </body> tag
  if (html.includes("</body>")) {
    return html.replace("</body>", `${offlineScripts}</body>`);
  } else {
    return html + offlineScripts;
  }
}

/**
 * Generates a universal service worker that caches everything automatically
 * @returns {string} Service worker JavaScript code
 */
export function generateServiceWorker() {
  return `
const CACHE_NAME = 'auto-offline-v1';

// Install event - just activate immediately
self.addEventListener('install', event => {
  console.log('SW Install - Auto-caching mode');
  event.waitUntil(self.skipWaiting());
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('SW Activate');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - cache everything automatically
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Always cache successful responses (except service worker itself)
        if (response.ok && !event.request.url.includes('/sw.js')) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseClone);
              console.log('Cached:', event.request.url);
            });
        }
        return response;
      })
      .catch(() => {
        // When offline, try to serve from cache
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              console.log('Serving from cache:', event.request.url);
              return cachedResponse;
            }
            
            // For API calls, return a generic offline response
            if (event.request.url.includes('/api/')) {
              return new Response(JSON.stringify({
                error: 'Offline',
                message: 'No cached data available',
                timestamp: new Date().toISOString()
              }), {
                headers: { 'Content-Type': 'application/json' },
                status: 503
              });
            }
            
            // For other requests, return a basic offline message
            return new Response('Offline - No cached version available', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Handle skip waiting message
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
`;
}
