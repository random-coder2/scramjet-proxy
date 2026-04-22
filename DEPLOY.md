# VPS Deployment Guide (Ubuntu)

## Quick Setup on Ubuntu VPS

1. **SSH into your VPS:**
   ```bash
   ssh user@your-vps-ip
   ```

2. **Install Node.js 18+:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Upload the project:**
   ```bash
   # From your local machine:
   scp -r scramjet-proxy user@your-vps-ip:~/
   
   # Or clone from git if you pushed it:
   git clone <your-repo>
   ```

4. **Install dependencies:**
   ```bash
   cd scramjet-proxy
   npm install
   ```

5. **Start the server:**
   ```bash
   npm start
   ```

6. **Access it:**
   - Open browser: `http://your-vps-ip:8080`

## Production Setup (PM2)

1. **Install PM2:**
   ```bash
   sudo npm install -g pm2
   ```

2. **Start with PM2:**
   ```bash
   pm2 start server.js --name scramjet-proxy
   pm2 startup
   pm2 save
   ```

3. **Monitor:**
   ```bash
   pm2 logs scramjet-proxy
   pm2 status
   ```

## Firewall Setup

```bash
# Allow port 8080
sudo ufw allow 8080/tcp

# Or for HTTPS (443) if using nginx/caddy
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp
```

## Using Nginx as Reverse Proxy (Optional)

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
    }
    
    location /wisp/ {
        proxy_pass http://localhost:8080/wisp/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Environment Variables

```bash
# Custom port
PORT=3000 npm start

# Custom host (0.0.0.0 for all interfaces)
HOST=0.0.0.0 npm start
```

## Troubleshooting

**WISP not working?**
- Check platform: `node -e "console.log(require('os').platform())"`
- Should show `linux` for full WISP support

**Port already in use?**
```bash
sudo lsof -i :8080
sudo kill -9 <PID>
```

**Permission denied?**
```bash
chmod +x server.js
```
