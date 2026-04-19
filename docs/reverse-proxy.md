# Reverse Proxy Setup

ZynqCloud listens on port `80` inside the container, exposed to the host on `APP_PORT` (default `3000`). Put a reverse proxy in front for HTTPS and custom domains.

---

## Caddy (recommended — auto HTTPS)

```caddyfile
cloud.example.com {
    reverse_proxy localhost:3000
}
```

Caddy handles Let's Encrypt certificates automatically. Update `.env`:

```bash
COOKIE_DOMAIN=cloud.example.com
CORS_ORIGIN=https://cloud.example.com
FRONTEND_URL=https://cloud.example.com
COOKIE_SECURE=true
```

---

## nginx

```nginx
server {
    listen 80;
    server_name cloud.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name cloud.example.com;

    ssl_certificate     /etc/letsencrypt/live/cloud.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cloud.example.com/privkey.pem;

    client_max_body_size 16G;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

Add to `.env`:

```bash
TRUST_PROXY=true
COOKIE_SECURE=true
```

---

## Traefik (Docker labels)

Add to the `zynqcloud` service in `docker-compose.yml`:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.zynq.rule=Host(`cloud.example.com`)"
  - "traefik.http.routers.zynq.entrypoints=websecure"
  - "traefik.http.routers.zynq.tls.certresolver=letsencrypt"
  - "traefik.http.services.zynq.loadbalancer.server.port=80"
```

---

## Cloudflare Tunnel (no open ports)

```bash
CLOUDFLARE_TUNNEL_TOKEN=<token> docker compose --profile cloudflare up -d
```

Set the public hostname target to `http://zynqcloud:80` in the Cloudflare dashboard.

See the comment block in `docker-compose.yml` for full setup steps.

---

## LAN-only (no domain, HTTP)

For a homelab or office server accessed by IP:

```bash
COOKIE_SECURE=false
CORS_ORIGIN=http://192.168.1.100:3000
FRONTEND_URL=http://192.168.1.100:3000
COOKIE_DOMAIN=
```

Replace `192.168.1.100` with your server's local IP. No reverse proxy needed.
