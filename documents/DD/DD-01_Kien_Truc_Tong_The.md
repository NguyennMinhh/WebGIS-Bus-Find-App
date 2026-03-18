# DD-01 — Kiến Trúc Tổng Thể

> **Loại tài liệu:** Design Document
> **Phiên bản:** 1.0
> **Cập nhật lần cuối:** 2026-03-18
> **Trạng thái:** Draft

---

## 1. Technology Stack

| Thành phần | Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|-----------|---------|
| Frontend framework | React | 18.3.1 | UI component framework |
| Build tool | Vite | 6.0.3 | Dev server + bundler |
| Ngôn ngữ Frontend | TypeScript | 5.6.3 | Type safety |
| Styling | Tailwind CSS | 3.4.16 | Utility-first CSS |
| Map library | OpenLayers | 10.3.1 | Bản đồ tương tác + WMS |
| Backend framework | Django | 5.2 | REST API + ORM |
| GIS extension | GeoDjango | (tích hợp Django) | Spatial model fields |
| REST API | Django REST Framework | 3.16.0 | API serialization |
| CORS | django-cors-headers | 4.6.0 | CORS middleware |
| Database | PostgreSQL | 16 | Relational DB |
| Spatial extension | PostGIS | 3.4 | Spatial queries |
| Map tile server | GeoServer | 2.25.2 | WMS/WFS service |
| Container | Docker + Docker Compose | 24+ | Orchestration |
| Python | 3.12-slim | | Backend runtime |
| Node | 20-Alpine | | Frontend runtime |

---

## 2. Sơ Đồ Kiến Trúc Tổng Thể

```
┌──────────────────────────────────────────────────────────────────┐
│                         BROWSER / CLIENT                          │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                 React App (Port 5173)                    │    │
│  │                                                          │    │
│  │  ┌──────────┐   ┌─────────────────────────────────────┐ │    │
│  │  │  Header  │   │         MapView (OpenLayers)         │ │    │
│  │  └──────────┘   │                                     │ │    │
│  │                 │  Layer 1: OSM TileLayer              │ │    │
│  │                 │  Layer 2: WMS (bus routes)  ─────────┼─┼──┐ │
│  │                 │  Layer 3: WMS (bus stops)   ─────────┼─┼──┤ │
│  │                 └─────────────────────────────────────┘ │    │
│  │                              │ REST API calls            │    │
│  └──────────────────────────────┼───────────────────────────┘    │
└─────────────────────────────────┼────────────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────────┐
              │                   │                       │
              ▼                   │                       ▼
┌─────────────────────┐           │         ┌────────────────────────┐
│   Django Backend     │           │         │      GeoServer          │
│   (Port 8000)        │           │         │      (Port 8600)        │
│                     │           │         │                        │
│  /admin/  ──→ Admin │           └────────→│  WMS: routes_busroute  │
│  /api/    ──→ DRF   │                     │  WMS: routes_busstop   │
│                     │                     │                        │
│  Django ORM         │                     │  Connects to PostGIS   │
└──────────┬──────────┘                     └──────────┬─────────────┘
           │                                           │
           └──────────────────┬────────────────────────┘
                              │
                              ▼
                ┌─────────────────────────┐
                │   PostgreSQL + PostGIS   │
                │   (Port 5432)            │
                │                         │
                │  routes_busroute        │
                │  routes_busstop         │
                │  routes_routestop       │
                └─────────────────────────┘
```

---

## 3. Mô Tả Từng Thành Phần

### 3.1 Frontend (React + Vite)

**Vai trò:** Giao diện người dùng — hiển thị bản đồ và tương tác người dùng

**Cách hoạt động:**
1. Vite dev server phục vụ React app tại `localhost:5173`
2. React render `App.tsx` → `Header` + `MapView`
3. `MapView` dùng OpenLayers để tạo bản đồ
4. OpenLayers tải tiles nền từ OSM (Internet)
5. OpenLayers tải WMS tiles từ GeoServer (localhost:8600) để vẽ tuyến/điểm dừng
6. Trong tương lai: React gọi REST API Django (localhost:8000) để lấy dữ liệu JSON

**Files quan trọng:**
```
frontend/src/
├── App.tsx              — Root layout
├── hooks/useMap.ts      — Khởi tạo bản đồ OpenLayers
├── utils/mapConfig.ts   — Cấu hình URL GeoServer, tên layers
├── services/api.ts      — HTTP client
└── types/index.ts       — TypeScript interfaces
```

---

### 3.2 Backend Django

**Vai trò:** REST API server + ORM + Management commands + Admin interface

**Cách hoạt động:**
1. Django xử lý HTTP request đến `/api/` qua Django REST Framework
2. Django Admin (`/admin/`) cho phép quản lý dữ liệu trực tiếp
3. `import_geojson` command đọc file GeoJSON và ghi vào PostGIS
4. GeoDjango ORM xử lý spatial fields (Point, MultiLineString)

**Files quan trọng:**
```
backend/
├── backend/settings.py           — Cấu hình Django
├── routes/models.py              — BusRoute, BusStop, RouteStop
├── routes/admin.py               — GIS Admin interface
├── routes/management/commands/
│   └── import_geojson.py         — Data import pipeline
└── routes/serializers.py         — API serializers (placeholder)
```

---

### 3.3 GeoServer

**Vai trò:** Map tile server — render spatial data thành ảnh WMS tiles

**Cách hoạt động:**
1. GeoServer kết nối trực tiếp đến PostGIS database
2. Đọc bảng `routes_busroute` và `routes_busstop`
3. Khi Frontend request WMS tile, GeoServer:
   - Query PostGIS lấy geometry trong bounding box
   - Render ra ảnh PNG theo SLD style
   - Trả về ảnh cho Frontend
4. Frontend nhận ảnh và hiển thị như 1 layer trên bản đồ

**Điểm mạnh:** GeoServer tự động phản chiếu dữ liệu PostGIS — khi DB thay đổi, bản đồ tự cập nhật (sau khi cache bị invalidate).

**Workspace:** `busrouting`
**Layers:**
- `busrouting:routes_busroute` — đường tuyến xe buýt
- `busrouting:routes_busstop` — điểm dừng xe buýt

---

### 3.4 PostgreSQL + PostGIS

**Vai trò:** Lưu trữ dữ liệu không gian (spatial data)

**PostGIS extension cung cấp:**
- Kiểu dữ liệu không gian: `POINT`, `LINESTRING`, `MULTILINESTRING`, `POLYGON`...
- Hàm không gian: `ST_Distance`, `ST_Contains`, `ST_LineLocatePoint`, `ST_LineSubstring`...
- Index không gian (GIST) cho query nhanh theo bounding box

**Tại sao không dùng SQLite?**
- SQLite không hỗ trợ spatial extension đủ mạnh
- PostGIS cung cấp đầy đủ hàm GIS cần thiết cho tính năng tìm lộ trình
- GeoServer cần kết nối trực tiếp PostGIS (không hỗ trợ SQLite)

---

## 4. Luồng Dữ Liệu

### 4.1 Luồng hiển thị bản đồ (hiện tại)

```
Browser
  → GET http://localhost:5173/   (React App)
  → OpenLayers khởi tạo bản đồ
  → GET https://tile.openstreetmap.org/{z}/{x}/{y}.png  (OSM tiles — qua Internet)
  → GET http://localhost:8600/geoserver/busrouting/wms?...  (WMS tiles — local)
       └─→ GeoServer query PostGIS: SELECT geometry FROM routes_busroute WHERE bbox INTERSECTS ...
       └─→ GeoServer render PNG → trả về Browser
  → Bản đồ hiển thị đầy đủ
```

### 4.2 Luồng import dữ liệu

```
File tay-ho-datas.geojson
  → [Docker volume mount] → /geojson/tay-ho-datas.geojson (trong container)
  → python manage.py import_geojson
       └─→ Parse JSON → tách route features & stop features
       └─→ Tạo/cập nhật BusRoute (GeoDjango ORM)
       └─→ Tạo/cập nhật BusStop (GeoDjango ORM)
       └─→ Tạo RouteStop links từ @relations
       └─→ SQL PostGIS: Tính sequence bằng ST_LineLocatePoint
  → Dữ liệu lưu trong PostgreSQL/PostGIS
  → GeoServer tự động phản chiếu dữ liệu mới
```

### 4.3 Luồng API (tương lai)

```
Browser
  → GET http://localhost:8000/api/routes/
       └─→ Django URL routing → routes/urls.py
       └─→ View/ViewSet → Serializer
       └─→ GeoDjango ORM query PostGIS
       └─→ Serialize GeoJSON response
  → Frontend nhận JSON → cập nhật UI
```

---

## 5. Cấu Hình Mạng Docker

```yaml
Network: gis-network (bridge)

Services:
  db:        hostname "db",        port 5432 (exposed externally)
  backend:   hostname "backend",   port 8000 (exposed externally)
  geoserver: hostname "geoserver", port 8080 (mapped to 8600 externally)
  frontend:  hostname "frontend",  port 5173 (exposed externally)
```

**Tóm tắt port:**
| Service | Port bên trong Docker | Port bên ngoài (host) |
|---------|-----------------------|-----------------------|
| PostgreSQL | 5432 | 5432 |
| Django Backend | 8000 | 8000 |
| GeoServer | 8080 | 8600 |
| React Frontend | 5173 | 5173 |

**Lưu ý về hostname:**
- Trong Docker network, Backend dùng `db:5432` để kết nối DB
- Trong Docker network, GeoServer dùng `db:5432` để kết nối DB
- Từ browser (ngoài Docker), dùng `localhost:5432`, `localhost:8000`...
- Frontend code chạy trong **browser**, nên dùng `localhost:8000` (không phải `backend:8000`)

---

## 6. Cơ Chế CORS

Frontend (`localhost:5173`) gọi Backend API (`localhost:8000`) → khác origin → cần CORS.

**Cấu hình trong `settings.py`:**
```python
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]
```

**GeoServer CORS:** Được bật qua biến môi trường Docker trong `docker-compose.yml`:
```yaml
GEOSERVER_CORS_ENABLED: "true"
GEOSERVER_CORS_ALLOWED_ORIGINS: "*"
```

---

## 7. Hệ Tọa Độ (Coordinate Reference Systems)

Đây là điểm dễ gây nhầm lẫn trong dự án GIS:

| Nơi sử dụng | CRS | Mô tả |
|-------------|-----|-------|
| Database (PostGIS) | EPSG:4326 (WGS84) | Kinh/vĩ độ thực, đơn vị độ |
| GeoJSON import | EPSG:4326 (WGS84) | Standard GeoJSON format |
| OpenLayers display | EPSG:3857 (Web Mercator) | Đơn vị mét, dùng cho web map |
| OSM tiles | EPSG:3857 | Chuẩn của web tiling scheme |
| GeoServer WMS | EPSG:4326 → tự convert | Tự handle conversion |

**Quan trọng:**
- `fromLonLat([105.8412, 21.0245])` trong OpenLayers: tự convert từ EPSG:4326 → EPSG:3857
- PostGIS lưu `SRID=4326` nhưng GeoServer render ra EPSG:3857 cho OpenLayers
- Khi frontend gọi WMS, GeoServer tự convert CRS
