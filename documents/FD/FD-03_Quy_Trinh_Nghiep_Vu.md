# FD-03 — Quy Trình Nghiệp Vụ

> **Loại tài liệu:** Functional Document
> **Phiên bản:** 1.0
> **Cập nhật lần cuối:** 2026-03-18
> **Trạng thái:** Draft

---

## 1. Quy Trình Cập Nhật Dữ Liệu Từ OSM

Đây là quy trình quan trọng nhất để duy trì tính cập nhật của dữ liệu hệ thống.

### 1.1 Lấy dữ liệu từ Overpass API

**Bước 1:** Truy cập [Overpass Turbo](https://overpass-turbo.eu/) và chạy query:

```overpassql
[out:json][timeout:60];
area["name"="Tây Hồ"]["admin_level"="8"]->.searchArea;
(
  relation["route"="bus"](area.searchArea);
  node["highway"="bus_stop"](area.searchArea);
);
out geom;
```

**Bước 2:** Export ra file GeoJSON → Lưu vào `./data/tay-ho-datas.geojson`

**Bước 3:** Khởi động lại Docker Compose (nếu cần để mount file mới):
```bash
docker compose restart backend
```

### 1.2 Chạy lệnh import

```bash
# Kiểm tra dịch vụ đang chạy
docker compose ps

# Import dữ liệu (cập nhật bình thường)
docker compose exec backend python manage.py import_geojson

# Import lại từ đầu (xóa sạch dữ liệu cũ)
docker compose exec backend python manage.py import_geojson --clear
```

### 1.3 Kiểm tra kết quả

1. Mở `http://localhost:8000/admin/routes/busroute/` — xem danh sách tuyến
2. Mở `http://localhost:8000/admin/routes/busstop/` — xem danh sách điểm dừng
3. Mở `http://localhost:5173/` — kiểm tra bản đồ hiển thị đúng

### 1.4 Lưu ý quan trọng
- GeoServer **không cần làm gì thêm** — tự động lấy dữ liệu từ PostGIS
- Nếu GeoServer không hiển thị dữ liệu mới: xóa cache → `Caches > Truncate All`
- Dữ liệu OSM có thể có geometry không chuẩn (LineString thay vì MultiLineString) → hệ thống tự xử lý

---

## 2. Quy Trình Cài Đặt Môi Trường Phát Triển

### 2.1 Yêu cầu hệ thống

| Phần mềm | Phiên bản tối thiểu | Ghi chú |
|----------|---------------------|---------|
| Docker Desktop | 24.0+ | Bắt buộc |
| Docker Compose | 2.20+ | Tích hợp trong Docker Desktop |
| Git | 2.x | |
| Trình duyệt | Chrome/Firefox mới nhất | |

### 2.2 Các bước khởi động lần đầu

```bash
# 1. Clone repo
git clone <repo-url>
cd WebGIS-BusRouting

# 2. Tạo file .env từ mẫu
cp .env.example .env
# (Không cần chỉnh sửa gì với cấu hình default)

# 3. Khởi động tất cả services
docker compose up -d

# 4. Đợi services khởi động (khoảng 30-60 giây)
docker compose ps
# Tất cả status phải là "healthy" hoặc "running"

# 5. Chạy database migrations
docker compose exec backend python manage.py migrate

# 6. Tạo superuser cho Django Admin
docker compose exec backend python manage.py createsuperuser

# 7. Import dữ liệu mẫu (nếu có file GeoJSON)
docker compose exec backend python manage.py import_geojson

# 8. Kiểm tra ứng dụng
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000/api/
# Django Admin: http://localhost:8000/admin/
# GeoServer Admin: http://localhost:8600/geoserver/web/
```

### 2.3 Cấu hình GeoServer (thực hiện 1 lần sau khi cài)

1. Mở `http://localhost:8600/geoserver/web/`
2. Đăng nhập: admin / geoserver
3. Tạo Store mới:
   - Type: PostGIS
   - Host: db, Port: 5432, Database: busrouting
   - User: postgres, Password: postgres
4. Publish 2 layers:
   - `routes_busroute` (tuyến xe buýt)
   - `routes_busstop` (điểm dừng)

> **Quan trọng:** Đặt tên workspace là `busrouting` để khớp với cấu hình trong code frontend.

---

## 3. Quy Trình Kiểm Tra Hệ Thống

### 3.1 Kiểm tra từng thành phần

| Thành phần | URL kiểm tra | Kết quả mong đợi |
|-----------|-------------|-----------------|
| Frontend | http://localhost:5173 | Bản đồ Hà Nội hiển thị |
| Backend API | http://localhost:8000/api/ | JSON response |
| Django Admin | http://localhost:8000/admin/ | Trang đăng nhập Admin |
| GeoServer | http://localhost:8600/geoserver/web/ | Trang GeoServer Admin |
| Database | `docker compose exec db psql -U postgres busrouting` | Kết nối thành công |

### 3.2 Kiểm tra dữ liệu

```bash
# Kiểm tra số lượng bản ghi
docker compose exec db psql -U postgres busrouting -c "
SELECT
  (SELECT COUNT(*) FROM routes_busroute) AS routes,
  (SELECT COUNT(*) FROM routes_busstop) AS stops,
  (SELECT COUNT(*) FROM routes_routestop) AS links;
"
```

### 3.3 Kiểm tra WMS GeoServer hoạt động

```
Mở trình duyệt, truy cập:
http://localhost:8600/geoserver/busrouting/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities
```
→ Kết quả mong đợi: XML mô tả các layer đang available

---

## 4. Quy Trình Xử Lý Sự Cố Thường Gặp

### 4.1 Bản đồ không hiển thị tuyến/điểm dừng

**Nguyên nhân có thể:**
1. GeoServer chưa chạy → `docker compose ps` kiểm tra
2. Chưa publish layers trên GeoServer → làm bước 2.3
3. Chưa có dữ liệu trong DB → chạy `import_geojson`
4. Tên workspace/layer sai → kiểm tra `mapConfig.ts`

**Cách khắc phục:**
```bash
docker compose logs geoserver  # Xem log GeoServer
docker compose restart geoserver
```

### 4.2 Backend không kết nối được database

```bash
docker compose logs backend  # Xem lỗi
docker compose restart backend  # Restart sau khi DB ready
```

### 4.3 Lỗi import_geojson: "File not found"

```bash
# Kiểm tra file đã được mount chưa
docker compose exec backend ls /geojson/
# Nếu không thấy file → kiểm tra docker-compose.yml volume mount
```

### 4.4 Sequence của điểm dừng = 0 (lỗi đã biết)

**Vấn đề:** Một số tuyến có `ST_LineMerge(path)` không tạo ra `ST_LineString` mà vẫn là `MultiLineString` (do geometry không liên tục). PostGIS không thể tính `ST_LineLocatePoint` → sequence giữ nguyên = 0.

**Nguyên nhân:** Đường tuyến OSM bị tách thành nhiều đoạn không liền nhau (thường xảy ra với tuyến vòng hoặc tuyến có đoạn 2 chiều).

**Giải pháp tạm thời:** Sequence = 0 cho những điểm dừng này, không ảnh hưởng đến hiển thị bản đồ.

**Giải pháp lâu dài:** Dùng `ST_ClosestPoint` hoặc thứ tự nhập trong GeoJSON để gán sequence.

---

## 5. Quy Trình Thêm Vùng Dữ Liệu Mới

Ví dụ: Muốn thêm dữ liệu quận Đống Đa vào hệ thống

**Bước 1:** Query Overpass cho quận Đống Đa:
```overpassql
area["name"="Đống Đa"]["admin_level"="8"]->.a;
(relation["route"="bus"](area.a); node["highway"="bus_stop"](area.a););
out geom;
```

**Bước 2:** Export file → `./data/dong-da-datas.geojson`

**Bước 3:** Import (không dùng `--clear` để giữ dữ liệu Tây Hồ):
```bash
docker compose exec backend python manage.py import_geojson /geojson/dong-da-datas.geojson
```

**Bước 4:** Kiểm tra bản đồ — tuyến quận Đống Đa sẽ xuất hiện tự động.
