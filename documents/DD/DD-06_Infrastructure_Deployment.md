# DD-06 — Infrastructure & Deployment

> **Loại tài liệu:** Design Document
> **Phiên bản:** 1.0
> **Cập nhật lần cuối:** 2026-03-18
> **Trạng thái:** Draft

---

## 1. Docker Compose Overview

**File:** [docker-compose.yml](../../docker-compose.yml)

Toàn bộ hệ thống chạy trên **4 Docker services** trong 1 Docker network:

```
docker-compose.yml
├── db          (PostgreSQL + PostGIS)
├── backend     (Django)
├── geoserver   (GeoServer)
└── frontend    (React + Vite)
```

**Network:** `gis-network` (bridge driver)

---

## 2. Chi Tiết Từng Service

### 2.1 Service: `db`

```yaml
db:
  image: postgis/postgis:16-3.4       # PostgreSQL 16 + PostGIS 3.4
  environment:
    POSTGRES_DB: busrouting
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
  ports:
    - "5432:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data  # Persistent volume
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 5s
    timeout: 5s
    retries: 5
  networks:
    - gis-network
```

**Điểm quan trọng:**
- `postgis/postgis:16-3.4`: image chính thức có PostGIS pre-installed
- PostGIS extension được kích hoạt tự động khi tạo database mới
- `healthcheck`: Backend chỉ start sau khi DB ready (dependency health check)
- `postgres_data` volume: dữ liệu không bị mất khi restart container

**Persistent data:**
```
postgres_data volume → /var/lib/postgresql/data (trong container)
→ Tự động backup khi container restart
→ Mất khi chạy: docker compose down -v (volume flag)
```

---

### 2.2 Service: `backend`

```yaml
backend:
  build: ./backend                     # Build từ ./backend/Dockerfile
  environment:
    - POSTGRES_DB=busrouting
    - POSTGRES_USER=postgres
    - POSTGRES_PASSWORD=postgres
    - POSTGRES_HOST=db                 # Docker hostname của service db
    - POSTGRES_PORT=5432
    - DJANGO_SECRET_KEY=${DJANGO_SECRET_KEY}
    - DJANGO_DEBUG=True
    - DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend,0.0.0.0
  ports:
    - "8000:8000"
  volumes:
    - ./backend:/app                   # Hot reload: mount source code
    - ./data/tay-ho-datas.geojson:/geojson/tay-ho-datas.geojson:ro  # Read-only
  command: python manage.py runserver 0.0.0.0:8000
  depends_on:
    db:
      condition: service_healthy       # Chờ DB healthcheck pass
  networks:
    - gis-network
```

**Backend Dockerfile:**
```dockerfile
FROM python:3.12-slim

# Cài system dependencies cho GDAL/PostGIS
RUN apt-get update && apt-get install -y \
    gdal-bin libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
```

**Lưu ý GDAL:**
- GDAL là C library bắt buộc cho GeoDjango
- Phải cài system package trước khi cài Python package `GDAL`
- `gdal-bin libgdal-dev`: system libraries
- `GDAL==3.x.x` trong requirements.txt: Python bindings

**Volume mounts:**
1. `./backend:/app` — mount source code vào container → thay đổi code tự reload (dev mode)
2. `./data/...:/geojson/...` — mount file GeoJSON data → import_geojson đọc từ đây

---

### 2.3 Service: `geoserver`

```yaml
geoserver:
  image: kartoza/geoserver:2.25.2      # GeoServer 2.25.2 (official Kartoza image)
  environment:
    GEOSERVER_ADMIN_USER: admin
    GEOSERVER_ADMIN_PASSWORD: geoserver
    GEOSERVER_CSRF_DISABLED: "true"    # Tắt CSRF cho dev
    GEOSERVER_CORS_ENABLED: "true"
    GEOSERVER_CORS_ALLOWED_ORIGINS: "*"
  ports:
    - "8600:8080"                       # GeoServer nội bộ dùng port 8080, expose ra 8600
  volumes:
    - geoserver_data:/opt/geoserver/data_dir  # Lưu config layers, workspaces, styles
  depends_on:
    - db
  networks:
    - gis-network
```

**Lưu ý:**
- GeoServer dùng port 8080 nội bộ → map ra 8600 trên host (tránh conflict với các app khác dùng 8080)
- `geoserver_data` volume: lưu cấu hình workspace, layers, SLD styles
- **Cần manual config sau khi khởi động lần đầu** (xem FD-03)

**Khi nào mất config GeoServer?**
- `docker compose down` → KHÔNG mất (data trong volume)
- `docker compose down -v` → MẤT config (volume bị xóa)
- Khuyến nghị: backup `geoserver_data` volume định kỳ

---

### 2.4 Service: `frontend`

```yaml
frontend:
  build: ./frontend                    # Build từ ./frontend/Dockerfile
  environment:
    - VITE_API_URL=http://localhost:8000/api
    - VITE_GEOSERVER_URL=http://localhost:8600/geoserver
    - VITE_GEOSERVER_WORKSPACE=busrouting
  ports:
    - "5173:5173"
  volumes:
    - ./frontend/src:/app/src          # Hot reload: mount source
  command: npm run dev
  depends_on:
    - backend
  networks:
    - gis-network
```

**Frontend Dockerfile:**
```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
```

**Hot reload:** `./frontend/src` được mount vào container → khi sửa file TypeScript, Vite tự động reload browser.

**Lưu ý env vars:**
- `VITE_API_URL=http://localhost:8000` — chú ý: đây là URL từ **browser**, không phải trong Docker
- Từ browser: `localhost:8000` = Backend service
- Từ bên trong container: dùng `backend:8000` — nhưng frontend code chạy trong **browser**, không trong container

---

## 3. Startup Order & Dependencies

```
db (khởi động)
  ↓ (healthcheck pass)
backend (khởi động)
  ↓ (started)
geoserver (khởi động song song với backend)
  ↓ (started)
frontend (khởi động)
```

**Chi tiết:**
```yaml
backend:
  depends_on:
    db:
      condition: service_healthy   # Chờ pg_isready

frontend:
  depends_on:
    - backend                      # Chỉ chờ backend start, không wait healthy
```

---

## 4. Volumes

```yaml
volumes:
  postgres_data:    # Dữ liệu PostgreSQL
  geoserver_data:   # Config GeoServer (workspaces, layers, styles)
```

**Quản lý volumes:**
```bash
# Xem tất cả volumes
docker volume ls

# Xem dung lượng
docker system df -v

# Xóa volume (CẢNH BÁO: mất dữ liệu!)
docker compose down -v  # Xóa tất cả volumes

# Backup postgres data
docker run --rm -v webgis-busrouting_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres_backup.tar.gz /data
```

---

## 5. Environment Variables

**File:** [.env](../../.env) (không commit lên git)
**Mẫu:** [.env.example](../../.env.example) (commit lên git)

```bash
# Database
POSTGRES_DB=busrouting
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Django
DJANGO_SECRET_KEY=wq8-busrouting-local-dev-secret-key-change-in-production
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend,0.0.0.0

# GeoServer
GEOSERVER_ADMIN_USER=admin
GEOSERVER_ADMIN_PASSWORD=geoserver

# Frontend (VITE_ prefix = exposed to browser)
VITE_API_URL=http://localhost:8000/api
VITE_GEOSERVER_URL=http://localhost:8600/geoserver
VITE_GEOSERVER_WORKSPACE=busrouting
```

---

## 6. Các Lệnh Docker Thường Dùng

### 6.1 Khởi động / Dừng

```bash
# Khởi động tất cả services
docker compose up -d

# Xem logs realtime
docker compose logs -f

# Xem logs 1 service cụ thể
docker compose logs -f backend
docker compose logs -f geoserver

# Dừng (giữ volumes)
docker compose down

# Dừng và xóa volumes (RESET hoàn toàn)
docker compose down -v
```

### 6.2 Thực thi lệnh trong container

```bash
# Django management commands
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py import_geojson
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py shell

# PostgreSQL
docker compose exec db psql -U postgres busrouting

# Check container status
docker compose ps
```

### 6.3 Rebuild

```bash
# Rebuild khi thay đổi Dockerfile hoặc requirements.txt
docker compose build backend
docker compose up -d backend

# Rebuild tất cả
docker compose up -d --build
```

---

## 7. Checklist Kiểm Tra Hệ Thống

### 7.1 Sau khi khởi động lần đầu

```
□ docker compose ps → tất cả "running"
□ http://localhost:5173 → bản đồ hiển thị
□ http://localhost:8000/admin/ → trang đăng nhập
□ http://localhost:8600/geoserver/web/ → GeoServer admin

□ Chạy migrations: docker compose exec backend python manage.py migrate
□ Tạo superuser: docker compose exec backend python manage.py createsuperuser
□ Import data: docker compose exec backend python manage.py import_geojson
□ Cấu hình GeoServer (xem FD-03 mục 2.3)

□ Kiểm tra dữ liệu: http://localhost:8000/admin/routes/busroute/
□ Kiểm tra bản đồ có tuyến/điểm dừng: http://localhost:5173
```

### 7.2 Kiểm tra sức khỏe hệ thống

```bash
# Database
docker compose exec db pg_isready -U postgres

# Số lượng bản ghi
docker compose exec db psql -U postgres busrouting \
  -c "SELECT COUNT(*) FROM routes_busroute; SELECT COUNT(*) FROM routes_busstop;"

# Backend API
curl http://localhost:8000/api/

# GeoServer WMS
curl "http://localhost:8600/geoserver/busrouting/wms?SERVICE=WMS&REQUEST=GetCapabilities" | head -50
```

---

## 8. Production Deployment Notes

> **Lưu ý:** Dự án hiện đang ở giai đoạn development. Khi deploy production, cần thay đổi:

| Hạng mục | Dev (hiện tại) | Production |
|---------|----------------|-----------|
| Web server | `runserver` (dev) | Gunicorn + Nginx |
| Frontend | `vite dev` | `npm run build` + static serving |
| Secret key | Hardcoded dev key | Random key từ secrets manager |
| Debug | `True` | `False` |
| Database password | `postgres` | Strong random password |
| GeoServer password | `geoserver` | Strong random password |
| CORS | localhost | Production domain |
| HTTPS | Không | Bắt buộc |
| Database backup | Manual | Automated |
