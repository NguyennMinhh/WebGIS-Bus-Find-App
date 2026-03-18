# DD-07 — Developer Guide (Hướng Dẫn Cho Developer Mới)

> **Loại tài liệu:** Design Document
> **Phiên bản:** 1.0
> **Cập nhật lần cuối:** 2026-03-18
> **Trạng thái:** Draft

---

## 1. Đọc Tài Liệu Theo Thứ Tự Này

Nếu bạn vừa join dự án, đọc theo thứ tự sau:

1. **[FD-01](../FD/FD-01_Tong_Quan_Du_An.md)** — Hiểu dự án là gì, làm gì
2. **[FD-02](../FD/FD-02_Chuc_Nang_He_Thong.md)** — Danh sách tính năng, cái nào đã làm, cái nào chưa
3. **[DD-01](./DD-01_Kien_Truc_Tong_The.md)** — Kiến trúc tổng thể, services, luồng dữ liệu
4. **[DD-06](./DD-06_Infrastructure_Deployment.md)** — Cách chạy dự án trên máy local
5. **[DD-02](./DD-02_Database_Design.md)** — Database schema
6. **[DD-03](./DD-03_Backend_Design.md)** — Backend code
7. **[DD-04](./DD-04_Frontend_Design.md)** — Frontend code
8. **[DD-05](./DD-05_GIS_Spatial_Design.md)** — GIS/spatial chi tiết (đọc khi cần implement F-12)

---

## 2. Setup Máy Lần Đầu (15 phút)

### Bước 1: Clone & Chuẩn bị

```bash
git clone <repo-url>
cd WebGIS-BusRouting
cp .env.example .env
```

### Bước 2: Khởi động Docker

```bash
docker compose up -d
# Đợi khoảng 60 giây cho tất cả services khởi động
docker compose ps   # Kiểm tra tất cả "running"
```

### Bước 3: Setup Database

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
# Nhập username/password cho Django Admin (vd: admin / admin123)
```

### Bước 4: Import dữ liệu

```bash
docker compose exec backend python manage.py import_geojson
# Xem output để confirm số tuyến/điểm dừng được import
```

### Bước 5: Cấu hình GeoServer

1. Mở http://localhost:8600/geoserver/web/
2. Login: admin / geoserver
3. Tạo **Workspace** → Name: `busrouting`, Namespace URI: `http://busrouting`
4. Tạo **Store** → PostGIS:
   - Workspace: busrouting
   - Data source name: busrouting_postgis
   - Host: **db** (không phải localhost!), Port: 5432
   - Database: busrouting, User: postgres, Password: postgres
5. Publish **Layer** `routes_busroute` từ store trên
6. Publish **Layer** `routes_busstop` từ store trên
7. Với mỗi layer: set Native/Declared SRS = **EPSG:4326**, tính bounding box = "Compute from data"

### Bước 6: Kiểm tra

Mở http://localhost:5173 → Bản đồ Hà Nội xuất hiện với các đường tuyến xe buýt màu xanh.

---

## 3. Cấu Trúc File — Tóm Tắt Nhanh

```
WebGIS-BusRouting/
├── .env                          ← Cấu hình secrets (không commit)
├── .env.example                  ← Mẫu .env (có commit)
├── docker-compose.yml            ← Định nghĩa 4 services
│
├── backend/
│   ├── backend/settings.py       ← Cấu hình Django (DB, CORS, apps)
│   ├── routes/models.py          ← BusRoute, BusStop, RouteStop models
│   ├── routes/admin.py           ← GIS Admin interface
│   └── routes/management/commands/import_geojson.py  ← Import pipeline
│
├── frontend/
│   ├── src/hooks/useMap.ts       ← ⭐ Core: khởi tạo OpenLayers map
│   ├── src/utils/mapConfig.ts    ← ⭐ Config GeoServer URL + layer names
│   ├── src/services/api.ts       ← HTTP client
│   └── src/types/index.ts        ← TypeScript interfaces
│
├── data/
│   └── tay-ho-datas.geojson      ← Dữ liệu OSM (mount vào Docker)
│
└── documents/
    ├── FD/                       ← Functional Documents
    └── DD/                       ← Design Documents (file này)
```

---

## 4. Workflow Phát Triển Thường Ngày

### 4.1 Thêm tính năng backend (API endpoint mới)

```
1. Thêm code vào routes/serializers.py (Serializer class)
2. Thêm code vào routes/views.py (ViewSet/APIView)
3. Đăng ký URL trong routes/urls.py
4. Test: curl http://localhost:8000/api/<endpoint>/
```

Ví dụ thêm API list routes:
```python
# routes/serializers.py
class BusRouteListSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusRoute
        fields = ['id', 'ref', 'name', 'from_stop', 'to_stop']

# routes/views.py
from rest_framework import viewsets
class BusRouteViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = BusRoute.objects.all()
    serializer_class = BusRouteListSerializer

# routes/urls.py
from rest_framework.routers import DefaultRouter
router = DefaultRouter()
router.register(r'routes', BusRouteViewSet)
urlpatterns = router.urls
```

### 4.2 Thêm model field mới

```bash
# 1. Sửa models.py
# 2. Tạo migration
docker compose exec backend python manage.py makemigrations
# 3. Apply migration
docker compose exec backend python manage.py migrate
```

### 4.3 Thêm component frontend mới

```
1. Tạo file trong frontend/src/components/
2. Import và dùng trong App.tsx hoặc component cha
3. Vite auto-reload → thấy thay đổi ngay
```

### 4.4 Debug backend

```bash
# Xem logs realtime
docker compose logs -f backend

# Vào shell Python trong container
docker compose exec backend python manage.py shell

# Debug query PostGIS
docker compose exec db psql -U postgres busrouting
```

### 4.5 Debug frontend

```bash
# Xem logs frontend (Vite)
docker compose logs -f frontend

# Hoặc xem thẳng trong browser DevTools → Console
```

---

## 5. Conventions & Code Style

### 5.1 Backend (Django/Python)

**Naming:**
- Models: PascalCase (`BusRoute`, `BusStop`)
- Fields: snake_case (`osm_id`, `from_stop`)
- Functions: snake_case (`_import_routes`, `_compute_sequences`)
- Management commands: snake_case filenames (`import_geojson.py`)

**Quan trọng:**
- Luôn dùng `update_or_create` thay vì `create` khi import dữ liệu OSM
- Spatial fields: luôn khai báo `srid=4326` rõ ràng
- Raw SQL chỉ dùng khi ORM không đủ (như `_compute_sequences`)

### 5.2 Frontend (React/TypeScript)

**Naming:**
- Components: PascalCase files + function name (`MapView.tsx`, `function MapView()`)
- Hooks: `use` prefix (`useMap.ts`)
- Services: camelCase (`api.ts`)
- Types: PascalCase interfaces (`BusRoute`, `BusStop`)
- Constants: UPPER_SNAKE (`MAP_CENTER`, `MAP_ZOOM`)

**Patterns:**
- Custom hooks cho logic phức tạp (không để logic trong component)
- Barrel exports qua `index.ts` trong mỗi folder
- TypeScript interfaces trong `types/index.ts`
- Environment variables qua `import.meta.env.VITE_*`

---

## 6. Các Cạm Bẫy Thường Gặp (Gotchas)

### 6.1 "GeoServer không hiển thị data sau khi import"

**Nguyên nhân:** GeoServer cache tile cũ.
**Giải pháp:**
```
GeoServer Admin → Tile Caching → Truncate All (hoặc Seed/Truncate từng layer)
```

Hoặc hard refresh browser: `Ctrl+Shift+R`

---

### 6.2 "Sequence của điểm dừng đều = 0"

**Nguyên nhân:** Route geometry có đoạn không liên tục → `ST_LineMerge` không ra LineString → bỏ qua trong `_compute_sequences`.

**Kiểm tra:**
```sql
SELECT r.ref, ST_GeometryType(ST_LineMerge(r.path)) as merged_type
FROM routes_busroute r;
-- Nếu kết quả là 'ST_MultiLineString' → route này không tính được sequence
```

---

### 6.3 "Backend không kết nối được DB"

**Nguyên nhân phổ biến:** Backend start trước khi DB ready.
**Giải pháp:**
```bash
docker compose restart backend
# Hoặc
docker compose up -d  # Docker compose tự xử lý dependency
```

---

### 6.4 "WMS layer không hiển thị — lỗi 404 hoặc trắng"

**Checklist:**
1. GeoServer đang chạy? `docker compose ps`
2. Layer name đúng? Phải khớp với `LAYER_BUS_ROUTES` trong `mapConfig.ts`
3. Workspace name đúng? `busrouting` không phải `BusRouting`
4. Có dữ liệu trong DB? `SELECT COUNT(*) FROM routes_busroute;`
5. GeoServer có kết nối được DB? Kiểm tra trong GeoServer Admin → Stores

---

### 6.5 "Tọa độ bị lật (lat/lng nhầm)"

**PostGIS/GeoJSON convention:** `(longitude, latitude)` — kinh độ trước, vĩ độ sau
**Ví dụ Hà Nội:** `(105.8412, 21.0245)` = (lng, lat), KHÔNG phải `(21.0245, 105.8412)`

```python
# Đúng
Point(105.8046867, 21.055715, srid=4326)  # Point(lng, lat)

# Sai
Point(21.055715, 105.8046867, srid=4326)  # Point(lat, lng) — WRONG!
```

---

### 6.6 "CORS error khi frontend gọi API"

**Nguyên nhân:** Frontend origin không được allow.
**Kiểm tra `settings.py`:**
```python
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',  # Phải có
]
```

**Lưu ý thứ tự middleware:** `CorsMiddleware` phải **trước** `CommonMiddleware`.

---

### 6.7 "`import.meta.env.VITE_*` là undefined"

**Nguyên nhân:** Vite chỉ inject env vars có prefix `VITE_`.
**Kiểm tra:** File `.env` có `VITE_GEOSERVER_URL=...` chưa?
**Restart Vite** sau khi thay đổi `.env`:
```bash
docker compose restart frontend
```

---

## 7. Testing

### 7.1 Django Backend (chưa có tests)

Kế hoạch thêm tests:
```python
# routes/tests.py
from django.test import TestCase
from django.contrib.gis.geos import Point, MultiLineString, LineString
from .models import BusRoute, BusStop

class BusRouteTest(TestCase):
    def test_route_creation(self):
        route = BusRoute.objects.create(
            osm_id="test_001",
            ref="TEST",
            name="Test Route",
            from_stop="A", to_stop="B",
            path=MultiLineString(LineString((105.8, 21.0), (105.9, 21.1)), srid=4326)
        )
        self.assertEqual(route.ref, "TEST")
```

```bash
docker compose exec backend python manage.py test
```

### 7.2 Frontend (chưa có tests)

Kế hoạch: Vitest + React Testing Library

---

## 8. Git Workflow

```bash
# Tạo branch cho tính năng mới
git checkout -b feature/api-routes-endpoint

# Commit thường xuyên
git add backend/routes/views.py backend/routes/urls.py
git commit -m "feat: add BusRoute list API endpoint"

# Push và tạo PR
git push origin feature/api-routes-endpoint
```

**Commit message convention:**
- `feat:` — tính năng mới
- `fix:` — bug fix
- `docs:` — cập nhật tài liệu
- `refactor:` — cải thiện code không thêm tính năng
- `chore:` — thay đổi config, dependencies

---

## 9. Tóm Tắt Ports & URLs

| Service | URL | Dùng để |
|---------|-----|---------|
| Frontend | http://localhost:5173 | Ứng dụng chính |
| Backend API | http://localhost:8000/api/ | REST API |
| Django Admin | http://localhost:8000/admin/ | Quản lý dữ liệu |
| GeoServer | http://localhost:8600/geoserver/web/ | Config map layers |
| PostgreSQL | localhost:5432 | Kết nối DB từ tools (DBeaver, psql) |

**Database connection string (cho tools như DBeaver):**
```
Host: localhost
Port: 5432
Database: busrouting
User: postgres
Password: postgres
```
