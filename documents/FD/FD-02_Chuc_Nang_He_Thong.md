# FD-02 — Chức Năng Hệ Thống

> **Loại tài liệu:** Functional Document
> **Phiên bản:** 1.0
> **Cập nhật lần cuối:** 2026-03-18
> **Trạng thái:** Draft

---

## 1. Danh Sách Chức Năng

| Mã | Tên chức năng | Trạng thái | Ưu tiên |
|----|--------------|------------|---------|
| F-01 | Hiển thị bản đồ tương tác | Hoàn thành | P0 |
| F-02 | Hiển thị lớp tuyến xe buýt (WMS) | Hoàn thành | P0 |
| F-03 | Hiển thị lớp điểm dừng (WMS) | Hoàn thành | P0 |
| F-04 | Import dữ liệu từ GeoJSON (OSM) | Hoàn thành | P0 |
| F-05 | Quản lý dữ liệu qua Admin | Hoàn thành | P1 |
| F-06 | API danh sách tuyến xe buýt | Chưa làm | P1 |
| F-07 | API chi tiết tuyến xe buýt | Chưa làm | P1 |
| F-08 | API danh sách điểm dừng | Chưa làm | P1 |
| F-09 | Xem chi tiết tuyến khi click | Chưa làm | P1 |
| F-10 | Xem chi tiết điểm dừng khi click | Chưa làm | P1 |
| F-11 | Tìm kiếm tuyến theo số/tên | Chưa làm | P2 |
| F-12 | Tìm lộ trình giữa 2 điểm dừng | Chưa làm | P2 |

---

## 2. Mô Tả Chi Tiết Từng Chức Năng

---

### F-01 — Hiển thị bản đồ tương tác

**Mô tả:**
Người dùng thấy bản đồ tương tác chiếm toàn màn hình với bản đồ nền OSM. Có thể zoom in/out, kéo pan bản đồ.

**Điều kiện tiên quyết:** Kết nối internet (để tải OSM tiles)

**Hành vi:**
- Bản đồ mặc định tập trung vào khu vực Hà Nội (kinh độ 105.8412, vĩ độ 21.0245) ở mức zoom 12
- Người dùng có thể:
  - Scroll chuột để zoom in/out
  - Giữ trái và kéo để pan bản đồ
  - Double-click để zoom in nhanh
- Header cố định ở trên cùng không che khuất bản đồ (z-index phân tầng)

**Thành phần kỹ thuật:** `MapView.tsx` → `useMap.ts` → OpenLayers `Map` + `TileLayer` (OSM)

---

### F-02 — Hiển thị lớp tuyến xe buýt (WMS)

**Mô tả:**
Toàn bộ tuyến xe buýt được vẽ lên bản đồ dưới dạng các đường kẻ màu, sử dụng giao thức WMS từ GeoServer.

**Điều kiện tiên quyết:**
- GeoServer đang chạy tại `http://localhost:8600/geoserver`
- Layer `busrouting:routes_busroute` đã được publish trên GeoServer
- Có dữ liệu tuyến trong bảng `routes_busroute` (PostGIS)

**Hành vi:**
- Đường tuyến hiển thị là `MultiLineString` (nhiều đoạn thẳng tạo thành đường tuyến)
- Các tuyến khác nhau có thể hiển thị màu sắc khác nhau (do GeoServer SLD style)
- Khi zoom thay đổi, GeoServer render lại tiles phù hợp với độ phân giải mới
- Nếu GeoServer không khả dụng, lớp này sẽ không hiển thị (bản đồ nền OSM vẫn hiện)

**Thành phần kỹ thuật:** `useMap.ts` → OpenLayers `ImageLayer` + `ImageWMS`
```
URL: http://localhost:8600/geoserver/busrouting/wms
Params: LAYERS=busrouting:routes_busroute, SERVICE=WMS, VERSION=1.1.1
```

---

### F-03 — Hiển thị lớp điểm dừng (WMS)

**Mô tả:**
Tất cả điểm dừng xe buýt được hiển thị là các chấm/icon trên bản đồ, sử dụng WMS từ GeoServer.

**Điều kiện tiên quyết:**
- GeoServer đang chạy
- Layer `busrouting:routes_busstop` đã được publish
- Có dữ liệu điểm dừng trong bảng `routes_busstop` (PostGIS)

**Hành vi:**
- Điểm dừng hiển thị là `Point` (chấm tròn hoặc icon xe buýt, tùy SLD style)
- Khi zoom nhỏ (zoom < 12), điểm dừng có thể bị ẩn để tránh chồng chéo
- Khi zoom lớn (zoom > 14), điểm dừng hiển thị rõ với tên

**Thành phần kỹ thuật:** `useMap.ts` → OpenLayers `ImageLayer` + `ImageWMS`
```
URL: http://localhost:8600/geoserver/busrouting/wms
Params: LAYERS=busrouting:routes_busstop
```

---

### F-04 — Import dữ liệu từ GeoJSON (OSM)

**Mô tả:**
Admin chạy lệnh Django management command để nhập dữ liệu tuyến và điểm dừng từ file GeoJSON (xuất từ Overpass API).

**Cách sử dụng:**
```bash
# Import bình thường (update_or_create — không xóa dữ liệu cũ)
docker exec -it webgis-busrouting-backend-1 python manage.py import_geojson

# Chỉ định file tùy chỉnh
docker exec -it webgis-busrouting-backend-1 python manage.py import_geojson /path/to/file.geojson

# Xóa sạch rồi import lại
docker exec -it webgis-busrouting-backend-1 python manage.py import_geojson --clear
```

**Đầu vào:**
- File GeoJSON ở `/geojson/tay-ho-datas.geojson` (trong container, mount từ `./data/`)
- Format: Overpass API export với `@id` và `@relations` trong properties

**Đầu ra:**
- Bản ghi `BusRoute` được tạo/cập nhật trong DB
- Bản ghi `BusStop` được tạo/cập nhật trong DB
- Bản ghi `RouteStop` (liên kết tuyến-điểm dừng) được tạo
- Giá trị `sequence` (thứ tự điểm dừng) được tính toán bằng PostGIS

**Output console mẫu:**
```
Starting import from /geojson/tay-ho-datas.geojson
Routes: 12 mới, 0 bỏ qua (geometry lỗi)
Stops: 145 mới, 487 liên kết tuyến-trạm
Sequences computed.
Import completed.
```

**Xử lý lỗi:**
- Feature có geometry không hợp lệ → bỏ qua, tiếp tục
- `osm_id` trùng → cập nhật (update) thay vì báo lỗi
- Route không tồn tại trong `@relations` → bỏ qua link đó

---

### F-05 — Quản lý dữ liệu qua Admin

**Mô tả:**
Admin có thể xem, tìm kiếm, sửa, xóa dữ liệu tuyến và điểm dừng qua giao diện Django Admin.

**Truy cập:** `http://localhost:8000/admin/`

**Chức năng BusRoute Admin:**
- Danh sách: ref, name, from_stop, to_stop, operator
- Tìm kiếm theo: số tuyến (ref), tên, điểm đầu/cuối
- Lọc theo: operator
- Sửa chi tiết: hiển thị bản đồ nhỏ cho phép xem/sửa geometry (GISModelAdmin)

**Chức năng BusStop Admin:**
- Danh sách: name, osm_id
- Tìm kiếm theo: tên điểm dừng
- Sửa chi tiết: bản đồ nhỏ hiển thị vị trí điểm dừng (GISModelAdmin)

**Chức năng RouteStop Admin:**
- Danh sách: route, stop, sequence
- Lọc theo: route
- Xem thứ tự điểm dừng trên một tuyến

---

### F-06 — API danh sách tuyến xe buýt *(chưa triển khai)*

**Mô tả:** Trả về danh sách tất cả tuyến xe buýt dạng JSON

**Endpoint:** `GET /api/routes/`

**Response mẫu:**
```json
{
  "count": 12,
  "results": [
    {
      "id": 1,
      "ref": "09A",
      "name": "Trần Khánh Dư - Cầu Giấy - Đại học Mỏ",
      "from_stop": "Bờ Hồ",
      "to_stop": "Đại học Mỏ",
      "operator": "Công ty CP Vận tải & DV Liên Ninh",
      "opening_hours": "Mo-Su 05:00-21:30",
      "charge": "10000 VND",
      "interval": "00:15-00:20"
    }
  ]
}
```

**Filters dự kiến:** `?ref=09A`, `?operator=...`

---

### F-07 — API chi tiết tuyến xe buýt *(chưa triển khai)*

**Endpoint:** `GET /api/routes/{id}/`

**Response mẫu:**
```json
{
  "id": 1,
  "ref": "09A",
  "name": "Trần Khánh Dư - Cầu Giấy",
  "geometry": {
    "type": "MultiLineString",
    "coordinates": [[[105.8046, 21.055], ...]]
  },
  "stops": [
    {"id": 5, "name": "Đối diện Nhà hàng Ngọc Được 3", "sequence": 1, "lat": 21.055715, "lng": 105.8046867},
    {"id": 12, "name": "41 Võ Chí Công", "sequence": 2, "lat": 21.0613349, "lng": 105.8046536}
  ]
}
```

---

### F-08 — API danh sách điểm dừng *(chưa triển khai)*

**Endpoint:** `GET /api/stops/`

**Query params dự kiến:**
- `?near={lat},{lng}&radius={meters}` — tìm điểm dừng gần một tọa độ
- `?route={route_id}` — lọc theo tuyến

**Response mẫu:**
```json
{
  "count": 145,
  "results": [
    {
      "id": 5,
      "name": "Đối diện Nhà hàng Ngọc Được 3 - Võ Chí Công",
      "lat": 21.055715,
      "lng": 105.8046867,
      "routes": ["09A", "50"]
    }
  ]
}
```

---

### F-09 — Xem chi tiết tuyến khi click *(chưa triển khai)*

**Mô tả:** Người dùng click vào đường tuyến trên bản đồ, panel thông tin xuất hiện

**Luồng hoạt động:**
```
User click vào đường tuyến
  → OpenLayers bắt sự kiện 'click' trên map
  → Query feature tại điểm click (WMS GetFeatureInfo)
  → Lấy route_id từ response
  → Gọi GET /api/routes/{id}/
  → Hiển thị panel với thông tin tuyến + danh sách điểm dừng
  → Highlight tuyến được chọn trên bản đồ
```

---

### F-10 — Xem chi tiết điểm dừng khi click *(chưa triển khai)*

**Luồng hoạt động:**
```
User click vào điểm dừng
  → Popup xuất hiện tại vị trí điểm dừng
  → Hiển thị: tên điểm dừng, danh sách tuyến đi qua
  → Click vào tuyến trong popup → Xem chi tiết tuyến (F-09)
```

---

### F-11 — Tìm kiếm tuyến theo số/tên *(chưa triển khai)*

**Mô tả:** Ô tìm kiếm ở Header cho phép tìm tuyến theo số (vd: "09A") hoặc tên

**Luồng hoạt động:**
```
User gõ "09A" vào ô tìm kiếm
  → Gọi GET /api/routes/?ref=09A
  → Dropdown hiện danh sách kết quả
  → User chọn tuyến
  → Bản đồ zoom đến tuyến + highlight tuyến
  → Panel chi tiết tuyến xuất hiện
```

---

### F-12 — Tìm lộ trình giữa 2 điểm dừng *(chưa triển khai)*

**Mô tả:** Người dùng chọn điểm đi và điểm đến, hệ thống gợi ý tuyến xe buýt phù hợp và hiển thị lộ trình trên bản đồ.

**Luồng hoạt động:**
```
User chọn điểm dừng A (điểm đi) và điểm dừng B (điểm đến)
  → Gọi POST /api/find-route/ {from_stop: A_id, to_stop: B_id}
  → Backend tìm tuyến có cả 2 điểm dừng
  → Tính sub-route geometry: đoạn đường từ A đến B
  → Trả về: tuyến xe buýt + geometry đoạn đường + các điểm dừng trung gian
  → Frontend vẽ đoạn đường lên bản đồ (màu nổi bật)
  → Hiển thị thông tin: số điểm dừng, thời gian dự kiến, giá vé
```

**Thuật toán backend (PostGIS):**
```sql
-- Tìm tuyến có cả 2 điểm dừng
SELECT r.* FROM routes_busroute r
  JOIN routes_routestop rs1 ON rs1.route_id = r.id AND rs1.stop_id = {from_stop_id}
  JOIN routes_routestop rs2 ON rs2.route_id = r.id AND rs2.stop_id = {to_stop_id}
WHERE rs1.sequence < rs2.sequence;  -- Đúng chiều đi

-- Tính geometry đoạn đường
SELECT ST_LineSubstring(
  ST_LineMerge(r.path),
  ST_LineLocatePoint(ST_LineMerge(r.path), from_stop.location),
  ST_LineLocatePoint(ST_LineMerge(r.path), to_stop.location)
) AS sub_route
FROM routes_busroute r, routes_busstop from_stop, routes_busstop to_stop
WHERE r.id = {route_id}
  AND from_stop.id = {from_stop_id}
  AND to_stop.id = {to_stop_id};
```

---

## 3. Ma Trận Phụ Thuộc Chức Năng

```
F-01 (Bản đồ)
  └── F-02 (Lớp tuyến)     ← Cần GeoServer + dữ liệu
  └── F-03 (Lớp điểm dừng) ← Cần GeoServer + dữ liệu
       ↑
       F-04 (Import dữ liệu) ← Cần file GeoJSON

F-06 (API routes)
  └── F-09 (Click tuyến)
  └── F-11 (Tìm kiếm)

F-07 (API route detail)
  └── F-09 (Click tuyến)
  └── F-12 (Tìm lộ trình)

F-08 (API stops)
  └── F-10 (Click điểm dừng)
  └── F-12 (Tìm lộ trình)
```
