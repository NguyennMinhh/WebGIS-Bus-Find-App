# DD-02 — Thiết Kế Database

> **Loại tài liệu:** Design Document
> **Phiên bản:** 1.0
> **Cập nhật lần cuối:** 2026-03-18
> **Trạng thái:** Draft

---

## 1. Tổng Quan Schema

Hệ thống có **3 bảng chính** trong database `busrouting`:

```
┌──────────────────────────┐      ┌──────────────────────────┐
│      routes_busroute     │      │      routes_busstop      │
├──────────────────────────┤      ├──────────────────────────┤
│ id          BigAutoField │      │ id          BigAutoField │
│ osm_id      VARCHAR(30)  │      │ osm_id      VARCHAR(30)  │
│ ref         VARCHAR(20)  │      │ name        VARCHAR(200) │
│ name        VARCHAR(300) │      │ location    PointField   │
│ from_stop   VARCHAR(200) │      └────────────┬─────────────┘
│ to_stop     VARCHAR(200) │                   │
│ operator    VARCHAR(200) │        ┌──────────┴──────────────┐
│ opening_hours VARCHAR(100│        │    routes_routestop     │
│ charge      VARCHAR(50)  │        ├─────────────────────────┤
│ interval    VARCHAR(50)  ├────────│ route_id    FK          │
│ path        MultiLineStr │        │ stop_id     FK          │
└──────────────────────────┘        │ sequence    PositiveInt │
                                    └─────────────────────────┘
```

---

## 2. Chi Tiết Từng Bảng

### 2.1 Bảng `routes_busroute`

**Mô tả:** Lưu thông tin của MỖI CHIỀU của mỗi tuyến xe buýt.

**Quan trọng:** Tuyến 09A chiều đi và chiều về là **2 bản ghi riêng biệt** với `osm_id` khác nhau.

| Cột | Kiểu | Constraint | Mô tả |
|-----|------|------------|-------|
| `id` | `BigAutoField` | PRIMARY KEY | Auto-increment ID |
| `osm_id` | `VARCHAR(30)` | UNIQUE, INDEX | OSM relation ID (vd: "12726060") |
| `ref` | `VARCHAR(20)` | INDEX | Số tuyến (vd: "09A", "50") |
| `name` | `VARCHAR(300)` | | Tên đầy đủ tuyến |
| `from_stop` | `VARCHAR(200)` | | Tên điểm đầu tuyến |
| `to_stop` | `VARCHAR(200)` | | Tên điểm cuối tuyến |
| `operator` | `VARCHAR(200)` | nullable | Tên đơn vị vận hành |
| `opening_hours` | `VARCHAR(100)` | nullable | Giờ hoạt động (format OSM: "Mo-Su 05:00-21:30") |
| `charge` | `VARCHAR(50)` | nullable | Giá vé (vd: "10000 VND") |
| `interval` | `VARCHAR(50)` | nullable | Tần suất chạy (vd: "00:15-00:20") |
| `path` | `MultiLineStringField(srid=4326)` | NOT NULL | Đường đi đầy đủ của tuyến |

**Indexes:**
- `osm_id` — UNIQUE index (tìm kiếm nhanh theo OSM ID)
- `ref` — index thường (tìm kiếm theo số tuyến)

**Ví dụ bản ghi:**
```json
{
  "id": 1,
  "osm_id": "12726060",
  "ref": "09A",
  "name": "Trần Khánh Dư - Cầu Giấy - Đại học Mỏ",
  "from_stop": "Bờ Hồ",
  "to_stop": "Đại học Mỏ",
  "operator": "Công ty Cổ phần Vận tải & Dịch vụ Liên Ninh",
  "opening_hours": "Mo-Su 05:00-21:30",
  "charge": "10000 VND",
  "interval": "00:15-00:20",
  "path": "MULTILINESTRING((105.8046 21.055, 105.805 21.058, ...))"
}
```

---

### 2.2 Bảng `routes_busstop`

**Mô tả:** Lưu thông tin mỗi điểm dừng xe buýt.

| Cột | Kiểu | Constraint | Mô tả |
|-----|------|------------|-------|
| `id` | `BigAutoField` | PRIMARY KEY | Auto-increment ID |
| `osm_id` | `VARCHAR(30)` | UNIQUE, INDEX | OSM node ID (vd: "8741294713") |
| `name` | `VARCHAR(200)` | nullable | Tên điểm dừng |
| `location` | `PointField(srid=4326)` | NOT NULL | Tọa độ GPS |

**Quan hệ:**
- `routes` (ManyToMany → BusRoute, through=RouteStop)

**Ví dụ bản ghi:**
```json
{
  "id": 5,
  "osm_id": "8741294713",
  "name": "Đối diện Nhà hàng Ngọc Được 3 - Võ Chí Công",
  "location": "POINT(105.8046867 21.055715)"
}
```

---

### 2.3 Bảng `routes_routestop`

**Mô tả:** Bảng trung gian (junction table) liên kết tuyến và điểm dừng, đồng thời lưu thứ tự.

| Cột | Kiểu | Constraint | Mô tả |
|-----|------|------------|-------|
| `id` | `BigAutoField` | PRIMARY KEY | Auto-increment ID |
| `route_id` | `ForeignKey(BusRoute)` | NOT NULL, INDEX | Tuyến xe buýt |
| `stop_id` | `ForeignKey(BusStop)` | NOT NULL, INDEX | Điểm dừng |
| `sequence` | `PositiveIntegerField` | default=0 | Thứ tự điểm dừng trên tuyến (1, 2, 3...) |

**Constraints:**
- `UNIQUE(route_id, stop_id)` — mỗi điểm dừng chỉ xuất hiện 1 lần trên mỗi tuyến
- `ON DELETE CASCADE` — xóa tuyến/điểm dừng → xóa luôn link

**Default ordering:** `(route_id, sequence)` — sắp xếp theo tuyến rồi theo thứ tự

**Ví dụ bản ghi:**
| id | route_id | stop_id | sequence |
|----|----------|---------|----------|
| 1 | 1 | 5 | 1 |
| 2 | 1 | 12 | 2 |
| 3 | 1 | 8 | 3 |
| 4 | 2 | 5 | 3 | ← cùng stop_id=5, nhưng tuyến khác, sequence khác |

---

## 3. Entity-Relationship Diagram

```
BusRoute (1) ──────────── (M) RouteStop (M) ──────────── (1) BusStop
    osm_id (UNIQUE)              route_id (FK)                  osm_id (UNIQUE)
    ref                          stop_id  (FK)                  name
    name                         sequence                       location (POINT)
    path (MULTILINESTRING)
```

**Quan hệ:**
- 1 `BusRoute` có nhiều `RouteStop` → nhiều `BusStop`
- 1 `BusStop` có nhiều `RouteStop` → nhiều `BusRoute`
- Quan hệ ManyToMany thông qua `RouteStop` (để lưu `sequence`)

---

## 4. Các Query PostGIS Quan Trọng

### 4.1 Lấy tất cả điểm dừng của một tuyến, theo thứ tự

```sql
SELECT s.id, s.name, s.location, rs.sequence
FROM routes_busstop s
JOIN routes_routestop rs ON rs.stop_id = s.id
WHERE rs.route_id = 1
ORDER BY rs.sequence;
```

### 4.2 Tìm tuyến đi qua 2 điểm dừng cho trước (cho F-12)

```sql
SELECT r.*
FROM routes_busroute r
JOIN routes_routestop rs1 ON rs1.route_id = r.id AND rs1.stop_id = {from_id}
JOIN routes_routestop rs2 ON rs2.route_id = r.id AND rs2.stop_id = {to_id}
WHERE rs1.sequence < rs2.sequence;
```

### 4.3 Tính geometry đoạn đường từ điểm A đến điểm B (cho F-12)

```sql
SELECT ST_AsGeoJSON(
  ST_LineSubstring(
    ST_LineMerge(r.path),
    ST_LineLocatePoint(ST_LineMerge(r.path), from_s.location),
    ST_LineLocatePoint(ST_LineMerge(r.path), to_s.location)
  )
) AS sub_route_geojson
FROM routes_busroute r
  CROSS JOIN routes_busstop from_s
  CROSS JOIN routes_busstop to_s
WHERE r.id = {route_id}
  AND from_s.id = {from_stop_id}
  AND to_s.id = {to_stop_id};
```

### 4.4 Tìm điểm dừng gần một tọa độ (cho F-11)

```sql
SELECT s.*, ST_Distance(s.location::geography, ST_MakePoint({lng}, {lat})::geography) AS dist_meters
FROM routes_busstop s
WHERE ST_DWithin(s.location::geography, ST_MakePoint({lng}, {lat})::geography, 500)  -- 500 mét
ORDER BY dist_meters
LIMIT 10;
```

### 4.5 Tính sequence (dùng trong import_geojson)

```sql
UPDATE routes_routestop rs
SET sequence = sub.seq
FROM (
    SELECT
        rs2.id,
        ROW_NUMBER() OVER (
            PARTITION BY rs2.route_id
            ORDER BY ST_LineLocatePoint(ST_LineMerge(r.path), s.location)
        ) AS seq
    FROM routes_routestop rs2
    JOIN routes_busroute r ON r.id = rs2.route_id
    JOIN routes_busstop s ON s.id = rs2.stop_id
    WHERE ST_GeometryType(ST_LineMerge(r.path)) = 'ST_LineString'
) sub
WHERE rs.id = sub.id;
```

---

## 5. Giải Thích Các Hàm PostGIS Dùng Trong Dự Án

### 5.1 `ST_LineMerge(geometry)`

**Input:** MultiLineString (nhiều đoạn thẳng)
**Output:** LineString (1 đường liên tục) hoặc vẫn là MultiLineString nếu không thể merge

**Khi nào dùng:** Trước khi gọi `ST_LineLocatePoint` — hàm này chỉ hoạt động trên LineString, không hoạt động trên MultiLineString.

**Ví dụ:**
```
Input:  MULTILINESTRING((0 0, 1 1), (1 1, 2 2), (2 2, 3 3))
Output: LINESTRING(0 0, 1 1, 2 2, 3 3)
```

**Vấn đề:** Nếu các đoạn không liên tục (không chia sẻ điểm đầu/cuối), ST_LineMerge vẫn trả về MultiLineString → ST_LineLocatePoint sẽ fail.

---

### 5.2 `ST_LineLocatePoint(linestring, point)`

**Input:** LineString, Point
**Output:** Float trong khoảng [0.0, 1.0]

**Ý nghĩa:** Vị trí của điểm trên đường, tính từ đầu (0.0) đến cuối (1.0).

**Ví dụ:**
```
Route: A──────B──────C──────D (LineString)
       0.0   0.33   0.67   1.0

ST_LineLocatePoint(route, B) = 0.33
ST_LineLocatePoint(route, C) = 0.67
```

**Dùng để:** Xác định vị trí tương đối của điểm dừng trên tuyến → sắp xếp thứ tự.

---

### 5.3 `ST_LineSubstring(linestring, start_frac, end_frac)`

**Input:** LineString, float_start [0,1], float_end [0,1]
**Output:** LineString (đoạn con)

**Ví dụ:**
```
Full route: A──────B──────C──────D
            0.0   0.33   0.67   1.0

ST_LineSubstring(route, 0.33, 0.67) = B──────C
```

**Dùng để:** Tính geometry đoạn đường giữa điểm đi và điểm đến (F-12).

---

### 5.4 `ST_DWithin(geometry_a, geometry_b, radius)`

**Input:** Hai geometry, bán kính
**Output:** Boolean

**Ví dụ:** Tìm điểm dừng trong phạm vi 500m của một tọa độ.

**Lưu ý:** Dùng `::geography` để tính bằng mét (không phải độ).

---

## 6. Spatial Index (Index Không Gian)

PostGIS tự động tạo GIST spatial index cho các cột geometry khi dùng GeoDjango:

```sql
CREATE INDEX routes_busroute_path_id ON routes_busroute USING GIST (path);
CREATE INDEX routes_busstop_location_id ON routes_busstop USING GIST (location);
```

**GIST index hoạt động như thế nào:**
- Mỗi geometry được bao bởi một bounding box (MBR — Minimum Bounding Rectangle)
- GIST index lưu cây R-tree của các MBR
- Query `ST_DWithin`, `ST_Intersects`, `ST_Contains` sử dụng index để lọc nhanh
- Sau đó kiểm tra chính xác trên tập nhỏ đã lọc

**Kết quả:** Query không gian nhanh gấp nhiều lần so với full scan.

---

## 7. Database Migration

Migration Django quản lý schema:

```bash
# Xem migrations hiện có
docker compose exec backend python manage.py showmigrations

# Tạo migration mới (khi thay đổi models.py)
docker compose exec backend python manage.py makemigrations

# Apply migrations
docker compose exec backend python manage.py migrate
```

**File migration:** `backend/routes/migrations/0001_initial.py`
- Tạo 3 bảng: `routes_busroute`, `routes_busstop`, `routes_routestop`
- Tạo indexes và constraints
- Sử dụng `django.contrib.gis.db.models` cho spatial fields
