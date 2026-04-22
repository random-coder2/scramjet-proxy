// Scramjet Proxy Application
(function() {
    'use strict';

    // DOM Elements
    const urlInput = document.getElementById('url-input');
    const goBtn = document.getElementById('go-btn');
    const statusDiv = document.getElementById('status');
    const statusText = document.getElementById('status-text');
    const proxyFrame = document.getElementById('proxy-frame');

    // State
    let scramjetBundle = null;
    let isInitialized = false;

    // Wait for Scramjet bundle to load
    function waitForScramjet(timeout = 10000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const check = () => {
                // The bundle sets self.__scramjet$bundle
                if (typeof self !== 'undefined' && self.__scramjet$bundle) {
                    resolve(self.__scramjet$bundle);
                } else if (Date.now() - start > timeout) {
                    reject(new Error('Scramjet bundle failed to load in time'));
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    // Initialize the proxy
    async function init() {
        showStatus('Initializing proxy...');

        try {
            // Clear old service workers and caches
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const reg of registrations) {
                    await reg.unregister();
                    console.log('Old SW unregistered');
                }
                // Clear all caches
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    for (const name of cacheNames) {
                        await caches.delete(name);
                        console.log('Cache cleared:', name);
                    }
                }
            }

            // Wait for Scramjet bundle to load
            scramjetBundle = await waitForScramjet();
            console.log('Scramjet bundle loaded:', Object.keys(scramjetBundle));

            // Register fresh Service Worker
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.register('sw.js');
                console.log('Service Worker registered:', registration.scope);
            } else {
                throw new Error('Service Workers not supported');
            }
            
            isInitialized = true;
            hideStatus();
        } catch (error) {
            console.error('Initialization error:', error);
            showStatus(`Error: ${error.message}`, true);
        }
    }

    // Navigate to a URL through the proxy
    async function navigate(url) {
        if (!isInitialized) {
            showStatus('Please wait, still initializing...', true);
            return;
        }

        if (!url) {
            showStatus('Please enter a URL', true);
            return;
        }

        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        showStatus(`Loading ${url}...`);

        try {
            // Manual base64 encoding (Scramjet's encodeUrl is broken)
            const base64 = btoa(url);
            const encoded = `${window.location.origin}/~/${base64}`;
            
            console.log('Encoded URL:', encoded);
            
            // Load through iframe
            proxyFrame.src = encoded;
            proxyFrame.classList.remove('hidden');
            hideStatus();
        } catch (error) {
            console.error('Navigation error:', error);
            showStatus(`Error: ${error.message}`, true);
        }
    }

    // Show status message
    function showStatus(text, isError = false) {
        statusDiv.classList.remove('hidden');
        statusText.textContent = text;
        statusDiv.style.background = isError ? 'rgba(255, 0, 0, 0.1)' : 'rgba(0, 212, 255, 0.1)';
        statusText.style.color = isError ? '#ff6b6b' : '#fff';
    }

    // Hide status
    function hideStatus() {
        statusDiv.classList.add('hidden');
    }

    // Event Listeners
    goBtn.addEventListener('click', () => {
        navigate(urlInput.value.trim());
    });

    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            navigate(urlInput.value.trim());
        }
    });

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', init);
})();
