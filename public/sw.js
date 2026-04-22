// Scramjet Service Worker - Load local bundle
importScripts('/scramjet.bundle.js');

let scramjet = null;

// Check if Scramjet loaded properly - the bundle sets self.__scramjet$bundle
if (typeof self !== 'undefined' && self.__scramjet$bundle) {
    console.log('Scramjet bundle loaded:', Object.keys(self.__scramjet$bundle));
    // The bundle exports rewriter functions, we need to set up basic handling
    scramjet = {
        route: (event) => {
            // Route requests that should be proxied
            const url = new URL(event.request.url);
            return url.pathname.startsWith('/~/') || url.searchParams.has('scramjet');
        },
        fetch: async (event) => {
            try {
                const url = new URL(event.request.url);
                // Extract base64 from /~/BASE64 path
                if (url.pathname.startsWith('/~/')) {
                    const base64 = url.pathname.substring(3); // Remove /~/
                    const decoded = atob(base64);
                    console.log('SW: Decoded URL:', decoded);
                    return fetch(decoded);
                }
            } catch (e) {
                console.error('SW: Decode error:', e);
            }
            return fetch(event.request);
        },
        loadConfig: async () => true
    };
    console.log('Scramjet Service Worker initialized');
} else {
    console.error('Scramjet not loaded - __scramjet$bundle is undefined');
}

async function handleRequest(event) {
    // Just do normal fetch - let server handle proxying
    return fetch(event.request);
}

// Install and activate immediately
self.addEventListener('install', (event) => {
    console.log('SW: Installing...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('SW: Activating...');
    event.waitUntil(self.clients.claim());
});

// Fetch handler - intercept all requests
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Log all requests for debugging
    console.log('SW: Fetch', url.pathname);
    
    // Let /~/ URLs pass through to server (server handles proxying with proper CORS)
    if (url.pathname.startsWith('/~/')) {
        console.log('SW: Passing /~/ URL to server');
        // Don't intercept - let it go to server
        return;
    }
    
    // Handle other requests normally
    event.respondWith(handleRequest(event));
});
