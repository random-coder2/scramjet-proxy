# Scramjet Proxy

A simple web proxy powered by [Scramjet](https://github.com/MercuryWorkshop/scramjet) - an interception-based web proxy designed to evade internet censorship and bypass browser restrictions.

## Features

- **Fast & Secure**: Uses Scramjet's modern interception-based proxy technology
- **Easy to Deploy**: Works on both local PC and VPS/cloud servers
- **CAPTCHA Support**: Compatible with Google, YouTube, Discord, and more
- **WebSocket Support**: Full WebSocket proxying via WISP protocol
- **Modern UI**: Clean, responsive interface

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or higher
- npm, pnpm, or yarn

### Installation

1. **Clone or download this project**:
   ```bash
   git clone <repo-url> scramjet-proxy
   cd scramjet-proxy
   ```

2. **Install dependencies**:
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Start the server**:
   ```bash
   npm start
   # or
   pnpm start
   ```

4. **Open your browser**:
   Navigate to `http://localhost:8080`

## Deployment Options

### Local PC (Development)

Simply run:
```bash
npm start
```

Then access at `http://localhost:8080`

### VPS / Cloud Server (Production)

For production deployment on a VPS:

1. **Upload files** to your server
2. **Install Node.js 18+** if not already installed
3. **Install dependencies**: `npm install`
4. **Start with PM2** (recommended for production):
   ```bash
   npm install -g pm2
   pm2 start server.js --name scramjet-proxy
   pm2 save
   pm2 startup
   ```

5. **Set up a reverse proxy** with Nginx:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:8080;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

6. **Enable HTTPS** with Let's Encrypt:
   ```bash
   certbot --nginx -d your-domain.com
   ```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port |
| `HOST` | `0.0.0.0` | Server host (use `0.0.0.0` for all interfaces) |

Example:
```bash
PORT=3000 HOST=127.0.0.1 npm start
```

## Supported Sites

Scramjet supports many popular websites including:
- Google / YouTube
- Twitter / X
- Instagram
- Discord
- Reddit
- Spotify
- GeForce NOW
- And many more!

## Troubleshooting

### Service Worker not registering
- Ensure you're serving over HTTPS (required for Service Workers except on localhost)
- Check browser console for errors
- Try clearing browser cache and reloading

### Sites not loading
- Check that the WISP WebSocket endpoint is accessible (`/wisp/`)
- Verify your firewall allows WebSocket connections
- Check server logs for errors

### CAPTCHA issues
- Avoid hosting on datacenter IPs for better CAPTCHA support
- Consider using a residential IP or VPN
- Heavy traffic may trigger CAPTCHAs more frequently

## Architecture

This proxy uses:
- **Scramjet**: Core proxy engine that intercepts and rewrites web requests
- **BareMux**: Manages transport layers for encrypted communication
- **libcurl-transport**: HTTP/HTTPS transport with libcurl
- **WISP**: WebSocket protocol for tunneling connections
- **Express**: Web server framework

## License

MIT License - See [LICENSE](LICENSE) for details.

## Credits

- [Scramjet](https://github.com/MercuryWorkshop/scramjet) by Mercury Workshop
- [BareMux](https://github.com/MercuryWorkshop/bare-mux) by Mercury Workshop
- [WISP Protocol](https://github.com/MercuryWorkshop/wisp-server-python) by Mercury Workshop
