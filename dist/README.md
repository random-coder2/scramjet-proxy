# Scramjet Proxy Client

A standalone HTML proxy client that connects to a Scramjet proxy backend.

## Quick Start

### Option 1: jsDelivr CDN - HTML Version

```
https://cdn.jsdelivr.net/gh/YOUR_USERNAME/scramjet-proxy@main/dist/index.html
```

### Option 2: jsDelivr CDN - SVG Version (Stealth Mode)

The SVG version looks like an image but is fully functional:

```
https://cdn.jsdelivr.net/gh/YOUR_USERNAME/scramjet-proxy@main/dist/index.svg
```

**With pre-filled config via hash:**
```
https://cdn.jsdelivr.net/gh/YOUR_USERNAME/scramjet-proxy@main/dist/index.svg#/backend=http://your-server:8080/url=https://example.com
```

### Option 2: Download and Open Locally

1. Download `index.html`
2. Open it in any modern browser
3. Enter your proxy backend URL (e.g., `http://your-server:8080`)
4. Start browsing!

## How It Works

This is a **single-file HTML application** with:

- **No build step required** - Just HTML, CSS, and JavaScript
- **Inline Service Worker** - Created dynamically from a Blob URL
- **Configurable backend** - Connects to any Scramjet proxy server
- **Base64 URL encoding** - URLs are encoded as `/~/BASE64` format

## Backend Setup

You need a running Scramjet proxy server. See the main repo for server setup:

```bash
git clone https://github.com/YOUR_USERNAME/scramjet-proxy
cd scramjet-proxy
npm install
node server.js
```

## Default Configuration

The default backend is set to: `http://129.146.87.206:8080`

Change this in the UI or modify the `value` attribute in the HTML.

## Features

- ✅ Works from any domain (GitHub Pages, jsDelivr, local file)
- ✅ Configurable proxy backend
- ✅ Base64 URL encoding
- ✅ iframe-based browsing
- ✅ WebGL support (for games like Eaglercraft)
- ✅ Automatic Service Worker registration

## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

Requires Service Worker support.

## License

MIT
