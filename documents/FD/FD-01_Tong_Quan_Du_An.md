# FD-01 — Tổng Quan Dự Án

> **Loại tài liệu:** Functional Document
> **Phiên bản:** 1.0
> **Cập nhật lần cuối:** 2026-03-18
> **Trạng thái:** Draft

---

## 1. Giới Thiệu Dự Án

**WebGIS-BusRouting** là ứng dụng web GIS (Geographic Information System) cho phép hiển thị, tra cứu và quản lý mạng lưới tuyến xe buýt tại Hà Nội trên bản đồ tương tác. Dữ liệu được lấy từ OpenStreetMap (OSM) và lưu trữ trong cơ sở dữ liệu không gian PostGIS.

---

## 2. Mục Tiêu Dự Án

### 2.1 Mục tiêu chính
- Trực quan hóa toàn bộ mạng lưới tuyến xe buýt Hà Nội trên bản đồ tương tác
- Cho phép người dùng xem thông tin chi tiết từng tuyến và từng điểm dừng
- Hỗ trợ tra cứu lộ trình xe buýt giữa 2 điểm (tính năng lập kế hoạch)
- Cung cấp công cụ quản lý và cập nhật dữ liệu tuyến xe buýt

### 2.2 Mục tiêu kỹ thuật
- Xây dựng nền tảng WebGIS đáp ứng dữ liệu không gian (spatial data) quy mô thành phố
- Tích hợp pipeline nhập dữ liệu tự động từ OpenStreetMap (Overpass API)
- Kiến trúc microservices: Backend API + GeoServer WMS + Frontend Map

---

## 3. Phạm Vi Dự Án

### 3.1 Trong phạm vi (In scope)

| Hạng mục | Mô tả |
|----------|-------|
| Bản đồ tuyến xe buýt | Hiển thị toàn bộ tuyến xe buýt dưới dạng đường kẻ trên bản đồ |
| Bản đồ điểm dừng | Hiển thị tất cả điểm dừng dưới dạng điểm marker trên bản đồ |
| Chi tiết tuyến | Xem thông tin một tuyến: số tuyến, tên, đầu cuối, giờ chạy, giá vé |
| Chi tiết điểm dừng | Xem thông tin một điểm dừng: tên, địa chỉ, các tuyến đi qua |
| Nhập dữ liệu từ OSM | Import dữ liệu tuyến + điểm dừng từ file GeoJSON (xuất từ Overpass) |
| Quản lý dữ liệu qua Admin | Thêm/sửa/xóa tuyến và điểm dừng qua giao diện Django Admin |

### 3.2 Ngoài phạm vi (Out of scope — giai đoạn 1)

| Hạng mục | Ghi chú |
|----------|---------|
| Tìm đường (route finding) | Dự kiến giai đoạn 2 |
| Tích hợp GPS thời gian thực | Dự kiến giai đoạn 3 |
| Ứng dụng mobile | Không nằm trong kế hoạch hiện tại |
| Thanh toán vé điện tử | Ngoài phạm vi |

---

## 4. Đối Tượng Người Dùng

### 4.1 Hành khách phổ thông (Passenger)
- **Nhu cầu:** Xem bản đồ tuyến xe buýt để lên kế hoạch di chuyển
- **Kỹ năng kỹ thuật:** Thấp — chỉ cần biết dùng trình duyệt web
- **Thiết bị:** Desktop và mobile

### 4.2 Quản trị viên dữ liệu (Data Admin)
- **Nhu cầu:** Quản lý dữ liệu tuyến/điểm dừng, import dữ liệu mới từ OSM
- **Kỹ năng kỹ thuật:** Trung bình — biết thao tác Django Admin và chạy lệnh terminal
- **Thiết bị:** Desktop

---

## 5. Dữ Liệu Nguồn

### 5.1 OpenStreetMap (OSM) — nguồn dữ liệu chính
- **Nguồn:** https://www.openstreetmap.org
- **Phương thức lấy:** Overpass API query → export ra file GeoJSON
- **Khu vực hiện tại:** Quận Tây Hồ, Hà Nội (`tay-ho-datas.geojson`)
- **Cập nhật:** Thủ công — tải file GeoJSON mới và chạy lệnh import

### 5.2 Cấu trúc dữ liệu OSM nhận được
```
GeoJSON Feature Collection
├── Route features (type = "route")
│   ├── properties.@id: "relation/12726060"
│   ├── properties.ref: "09A"
│   ├── properties.name: "Trần Khánh Dư - Cầu Giấy - ..."
│   ├── properties.from: "Bờ Hồ"
│   ├── properties.to: "Đại học Mỏ"
│   ├── properties.operator: "Công ty ..."
│   ├── properties.opening_hours: "Mo-Su 05:00-21:30"
│   ├── properties.charge: "10000 VND"
│   ├── properties.interval: "00:15-00:20"
│   └── geometry: LineString hoặc MultiLineString
│
└── Stop features (geometry.type = "Point")
    ├── properties.@id: "node/8741294713"
    ├── properties.name: "Đối diện Nhà hàng..."
    ├── properties.@relations[]: [{rel: "12726060", ...}]
    └── geometry: Point [longitude, latitude]
```

**Lưu ý quan trọng về format Overpass:**
- `@id` là chuỗi `"relation/12726060"` → cần tách phần số `12726060`
- `@relations` trong properties của điểm dừng cho biết điểm đó thuộc tuyến nào
- Một điểm dừng có thể thuộc nhiều tuyến

---

## 6. Các Màn Hình Chính

### 6.1 Màn hình bản đồ chính (Map View)
- Chiếm toàn bộ màn hình (full screen)
- Bản đồ nền: OpenStreetMap tiles
- Lớp tuyến xe buýt: đường kẻ màu (từ GeoServer WMS)
- Lớp điểm dừng: điểm marker (từ GeoServer WMS)
- Header cố định phía trên: tiêu đề + điều hướng

### 6.2 Màn hình chi tiết tuyến (Route Detail) *(dự kiến)*
- Hiển thị thông tin đầy đủ của tuyến đã chọn
- Danh sách điểm dừng theo thứ tự trên tuyến
- Tuyến được highlight trên bản đồ

### 6.3 Màn hình chi tiết điểm dừng (Stop Detail) *(dự kiến)*
- Tên, địa chỉ điểm dừng
- Danh sách các tuyến đi qua điểm dừng này

---

## 7. Luồng Người Dùng (User Flows)

### 7.1 Xem bản đồ tuyến xe buýt
```
Người dùng mở ứng dụng
  → Bản đồ hiển thị khu vực Hà Nội
  → Tất cả tuyến xe buýt hiển thị là đường kẻ màu trên bản đồ
  → Tất cả điểm dừng hiển thị là chấm tròn trên bản đồ
  → Người dùng có thể zoom in/out, pan bản đồ
```

### 7.2 Xem chi tiết một tuyến *(dự kiến)*
```
Người dùng click vào đường tuyến xe buýt trên bản đồ
  → Panel bên phải (hoặc popup) hiển thị:
      - Số tuyến: "09A"
      - Tên đầy đủ: "Trần Khánh Dư - Cầu Giấy - Đại học Mỏ"
      - Điểm đầu / điểm cuối
      - Giờ hoạt động: 05:00 - 21:30
      - Giá vé: 10,000 VND
      - Tần suất: 15-20 phút/chuyến
      - Danh sách điểm dừng theo thứ tự
```

### 7.3 Import dữ liệu từ OSM (Admin)
```
Admin tải file GeoJSON từ Overpass API
  → Đặt file vào thư mục /data/
  → Chạy lệnh: docker exec backend python manage.py import_geojson [--clear]
  → Hệ thống xử lý: tạo/cập nhật Routes → Stops → Links → Sequences
  → Dữ liệu mới xuất hiện trên bản đồ (GeoServer tự động lấy từ PostGIS)
```

---

## 8. Các Quy Tắc Nghiệp Vụ Quan Trọng

### 8.1 Quy tắc về tuyến xe buýt
- Mỗi **chiều đi** và **chiều về** của cùng một số tuyến là 2 bản ghi BusRoute **riêng biệt**, phân biệt nhau bởi `osm_id` khác nhau
- Ví dụ: Tuyến 09A chiều đi (osm_id: 12726060) ≠ Tuyến 09A chiều về (osm_id khác)
- `ref` là mã số tuyến (ví dụ: "09A", "50"), có thể trùng giữa 2 chiều
- `osm_id` là định danh duy nhất, không trùng

### 8.2 Quy tắc về điểm dừng
- Một điểm dừng vật lý có thể phục vụ nhiều tuyến xe buýt khác nhau
- Vị trí điểm dừng là tọa độ GPS (Point) trong hệ SRID 4326 (WGS84)
- Thứ tự điểm dừng trên tuyến (sequence) được tính từ vị trí tương đối trên đường tuyến

### 8.3 Quy tắc về geometry
- Đường tuyến xe buýt lưu dưới dạng `MultiLineString` (nhiều đoạn thẳng ghép lại)
- Tọa độ trong hệ WGS84 (SRID=4326): kinh độ trước, vĩ độ sau `[lng, lat]`
- Khi hiển thị trên OpenLayers, hệ tọa độ tự động chuyển sang Web Mercator (EPSG:3857)

### 8.4 Quy tắc import dữ liệu
- Import sử dụng `update_or_create` theo `osm_id` → chạy nhiều lần không tạo dữ liệu trùng
- Nếu chạy với flag `--clear`, toàn bộ dữ liệu cũ bị xóa trước khi import
- Thứ tự điểm dừng (sequence) luôn được tính lại sau mỗi lần import

---

## 9. Các Ràng Buộc Và Giả Định

### 9.1 Ràng buộc kỹ thuật
- Chạy trên localhost (dev) với Docker Compose
- Dữ liệu chỉ bao gồm khu vực đã query từ OSM (hiện tại: Tây Hồ)
- GeoServer cần được cấu hình thủ công (publish layers) sau khi khởi động lần đầu

### 9.2 Giả định
- Dữ liệu OSM cho Hà Nội đã đầy đủ và chính xác
- Người dùng có kết nối internet để tải tiles bản đồ nền từ OSM
- GeoServer đang chạy và đã publish layers `busrouting:routes_busroute` và `busrouting:routes_busstop`
