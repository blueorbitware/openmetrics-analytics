# Deployment Guide

## Quick Start (5 minutes)

### Option 1: Single Server with Docker (Easiest)

**Requirements:** A VPS with 4GB+ RAM (DigitalOcean, Hetzner, Linode, etc.)

```bash
# 1. SSH into your server
ssh root@your-server-ip

# 2. Install Docker
curl -fsSL https://get.docker.com | sh

# 3. Clone the repo
git clone https://github.com/your-repo/analytics.git
cd analytics

# 4. Configure environment
cp .env.example .env
nano .env  # Edit with your settings (see below)

# 5. Start everything
cd deploy
docker-compose up -d

# 6. Done! Access at:
# Dashboard: http://your-server-ip:3000
# API: http://your-server-ip:8080
# Collector: http://your-server-ip:8081
```

### Environment Variables to Change

Edit `.env` file:

```bash
# REQUIRED - Change these!
JWT_SECRET=generate-random-64-character-string-here-use-openssl
POSTGRES_PASSWORD=your-strong-password-here
CLICKHOUSE_PASSWORD=your-strong-password-here

# Your domain (after setting up DNS)
CORS_ORIGINS=https://analytics.yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_COLLECTOR_URL=https://collect.yourdomain.com
```

Generate a secure JWT secret:
```bash
openssl rand -hex 32
```

---

## Option 2: With Domain + HTTPS (Production)

### Step 1: Point DNS to your server

```
A record: analytics.yourdomain.com → your-server-ip
A record: api.yourdomain.com → your-server-ip  
A record: collect.yourdomain.com → your-server-ip
```

### Step 2: Install with Nginx + SSL

```bash
# Install Nginx and Certbot
apt update && apt install -y nginx certbot python3-certbot-nginx

# Get SSL certificates
certbot --nginx -d analytics.yourdomain.com -d api.yourdomain.com -d collect.yourdomain.com
```

### Step 3: Configure Nginx

Create `/etc/nginx/sites-available/analytics`:

```nginx
# Dashboard
server {
    listen 443 ssl http2;
    server_name analytics.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/analytics.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/analytics.yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}

# API
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/analytics.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/analytics.yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Collector (high traffic)
server {
    listen 443 ssl http2;
    server_name collect.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/analytics.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/analytics.yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Allow large batches
        client_max_body_size 1M;
    }
    
    # Serve tracking script
    location /t.js {
        proxy_pass http://localhost:8081/t.js;
        proxy_cache_valid 200 1h;
        add_header Cache-Control "public, max-age=3600";
    }
}
```

Enable the config:
```bash
ln -s /etc/nginx/sites-available/analytics /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### Step 4: Update .env for production

```bash
CORS_ORIGINS=https://analytics.yourdomain.com,https://yourwebsite.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_COLLECTOR_URL=https://collect.yourdomain.com
```

### Step 5: Restart services

```bash
cd deploy
docker-compose down
docker-compose up -d
```

---

## Add Tracking to Your Website

After deployment, add this to your website:

```html
<script src="https://collect.yourdomain.com/t.js?k=YOUR_PUBLIC_KEY" async></script>
```

Get your public key from: Dashboard → Projects → Your Project

---

## Useful Commands

```bash
# View logs
docker-compose logs -f api
docker-compose logs -f collector
docker-compose logs -f worker

# Restart a service
docker-compose restart api

# Stop everything
docker-compose down

# Update to latest version
git pull
docker-compose build
docker-compose up -d
```

---

## Server Recommendations

| Traffic Level | Server Size | Provider Examples |
|--------------|-------------|-------------------|
| < 100K events/month | 2GB RAM, 1 CPU | $5-10/mo (DO, Hetzner) |
| 100K - 1M events/month | 4GB RAM, 2 CPU | $20-40/mo |
| 1M - 10M events/month | 8GB RAM, 4 CPU | $40-80/mo |
| > 10M events/month | Consider scaling | Separate DB servers |

---

## Troubleshooting

**Can't connect to dashboard?**
```bash
docker-compose ps  # Check all services are running
docker-compose logs dashboard  # Check for errors
```

**Events not showing?**
```bash
docker-compose logs collector  # Check collector receiving events
docker-compose logs worker     # Check worker processing events
```

**Database issues?**
```bash
docker-compose exec postgres psql -U analytics -d analytics
# Run: SELECT COUNT(*) FROM projects;
```
