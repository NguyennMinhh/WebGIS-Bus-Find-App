# WebGIS — Tuyến Xe Buýt Hà Nội

Ứng dụng WebGIS hiển thị và quản lý mạng lưới tuyến xe buýt Hà Nội trên bản đồ tương tác. Dữ liệu lấy từ OpenStreetMap, lưu trữ trong PostGIS, hiển thị qua GeoServer WMS + OpenLayers.

## Tech Stack

| Thành phần | Công nghệ |
|-----------|-----------|
| Frontend | React 18 + TypeScript + Vite + OpenLayers + Tailwind CSS |
| Backend | Django 5 + GeoDjango + Django REST Framework |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| Map Server | GeoServer 2.25 (WMS) |
| Container | Docker + Docker Compose |

## Cài Đặt & Chạy

### Yêu cầu
- Docker Desktop 24+
- Git

### Bước 1 — Clone & cấu hình

```bash
git clone <repo-url>
cd WebGIS-BusRouting
cp .env.example .env
```

### Bước 2 — Lấy dữ liệu OSM

File GeoJSON không được commit vào repo (là raw data). Tạo lại bằng cách:

1. Mở [Overpass Turbo](https://overpass-turbo.eu/)
2. Copy nội dung file [`data/overpass_query.overpassql`](./data/overpass_query.overpassql) vào editor
3. Click **Run** → **Export** → **Download as GeoJSON**
4. Lưu file vào `data/tay-ho-datas.geojson`

### Bước 3 — Khởi động

```bash
docker compose up -d
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py import_geojson
```

### Bước 4 — Cấu hình GeoServer (chỉ làm 1 lần)

Xem hướng dẫn chi tiết tại [documents/FD/FD-03_Quy_Trinh_Nghiep_Vu.md](./documents/FD/FD-03_Quy_Trinh_Nghiep_Vu.md) mục 2.3.

## Services & Ports

| Service | URL | Mô tả |
|---------|-----|-------|
| Frontend | http://localhost:5173 | Ứng dụng chính |
| Backend API | http://localhost:8000/api/ | REST API |
| Django Admin | http://localhost:8000/admin/ | Quản lý dữ liệu |
| GeoServer | http://localhost:8600/geoserver/web/ | Cấu hình map layers |

## Tài Liệu

| Loại | File | Nội dung |
|------|------|---------|
| FD | [FD-01 Tổng Quan](./documents/FD/FD-01_Tong_Quan_Du_An.md) | Mục tiêu, phạm vi, nghiệp vụ |
| FD | [FD-02 Chức Năng](./documents/FD/FD-02_Chuc_Nang_He_Thong.md) | Danh sách tính năng |
| FD | [FD-03 Quy Trình](./documents/FD/FD-03_Quy_Trinh_Nghiep_Vu.md) | Import data, setup, troubleshoot |
| DD | [DD-01 Kiến Trúc](./documents/DD/DD-01_Kien_Truc_Tong_The.md) | System architecture |
| DD | [DD-02 Database](./documents/DD/DD-02_Database_Design.md) | Schema, PostGIS queries |
| DD | [DD-03 Backend](./documents/DD/DD-03_Backend_Design.md) | Django models, API design |
| DD | [DD-04 Frontend](./documents/DD/DD-04_Frontend_Design.md) | React components, OpenLayers |
| DD | [DD-05 GIS](./documents/DD/DD-05_GIS_Spatial_Design.md) | Spatial functions, GeoServer |
| DD | [DD-06 Infrastructure](./documents/DD/DD-06_Infrastructure_Deployment.md) | Docker, deployment |
| DD | [DD-07 Dev Guide](./documents/DD/DD-07_Developer_Guide.md) | **Đọc cái này trước nếu mới join** |
