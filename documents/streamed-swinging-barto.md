# Plan: Hướng dẫn đầy đủ WebGIS-BusRouting

## Context
User cần hiểu sâu về project đã build: cách bảng tương tác, mối quan hệ MultiLineString ↔ trạm dừng,
và cách hiển thị đoạn tuyến người dùng thực sự đi (sub-route). Đây là tài liệu giải thích + plan sửa code.

## Deliverable
Viết 1 tài liệu markdown đầy đủ (trong conversation, không phải file .md) gồm:

1. Sơ đồ quan hệ bảng + ví dụ dữ liệu tuyến 09A
2. Giải thích MultiLineString vs trạm dừng (geometry không trùng nhau)
3. Cách hiển thị đoạn tuyến người dùng đi — cần thêm logic PostGIS
4. Bug: sequence = 0 trong import_geojson → cần sửa
5. Các điểm cần hiểu để build tiếp

---

## Nội dung chi tiết cần viết

### A. Quan hệ bảng (với ví dụ tuyến 09A)

```
BusRoute (id=1)
  osm_id = "12726060"
  ref = "09A"
  name = "Trần Khánh Dư - Cầu Giấy - Đại học Mỏ"
  from_stop = "Bờ Hồ", to_stop = "Đại học Mỏ"
  path = MULTILINESTRING((...2000+ điểm tọa độ...))
           ↑ toàn bộ lộ trình xe chạy

BusStop (id=3)
  name = "325 Âu Cơ"
  location = POINT(105.8607092, 21.0185284)

RouteStop
  route_id = 1  ← tuyến 09A
  stop_id  = 3  ← trạm 325 Âu Cơ
  sequence = 3  ← trạm thứ 3 trong tuyến
```

Mối quan hệ:
- BusRoute 1 — RouteStop N → BusStop N (nhiều-nhiều qua RouteStop)
- RouteStop là bảng trung gian lưu thứ tự (sequence)

### B. MultiLineString vs trạm dừng — câu trả lời quan trọng

**MultiLineString là gì?**
- Là toàn bộ đường xe chạy (~2000+ tọa độ GPS theo từng đoạn đường thực tế)
- KHÔNG phải mỗi LineString con = 1 đoạn từ trạm A đến trạm B
- Mỗi LineString con = 1 đoạn đường liên tục (OSM chia do nhiều lý do: thay đổi tên đường, 1 chiều, etc.)
- Tuyến 09A trong GeoJSON là LineString đơn → import sẽ wrap thành MultiLineString(1 linestring con duy nhất)

**Trạm dừng nằm ở đâu so với đường?**
- KHÔNG nằm trên đường (tọa độ khác hoàn toàn)
- Nằm bên lề đường, cách ~5-50m
- Liên kết qua RouteStop (M2M) — đây là liên kết logic, không phải geometry
- @relations trong GeoJSON OSM chứa thông tin này: stop nào thuộc relation (tuyến) nào

**Sơ đồ ASCII:**

```
Đường (MultiLineString path):
  ●━━━━━━━━━━━━●━━━━━━━━●━━━━━━━━━━━━●
  ↑ điểm GPS   ↑        ↑            ↑ (hàng ngàn điểm)

Trạm dừng (Point, nằm bên lề đường):
        ■               ■        ■
        ↑trạm A         ↑trạm B  ↑trạm C

Cách link: RouteStop bảng nói "trạm A thuộc tuyến X, thứ tự 1"
           KHÔNG có geometry connection
```

### C. Tìm và hiển thị đoạn tuyến người đi — PostGIS ST_LineSubstring

Đây là phần cần thêm logic mới vào views.py.

**Vấn đề hiện tại:**
- API `/api/find/` trả về toàn bộ geometry của tuyến (2000 điểm)
- Nhưng người dùng chỉ đi từ trạm A đến trạm B → chỉ cần đoạn giữa 2 trạm đó

**Giải pháp: PostGIS ST_LineLocatePoint + ST_LineSubstring**

Luồng logic:
```
1. Có tuyến X, trạm gần origin (stop_A), trạm gần dest (stop_B)
2. ST_LineMerge(route.path) → hợp nhất MultiLineString thành 1 LineString
3. ST_LineLocatePoint(merged_line, stop_A.location) → fraction_A (0.0 ~ 1.0)
4. ST_LineLocatePoint(merged_line, stop_B.location) → fraction_B
5. ST_LineSubstring(merged_line, min(fA,fB), max(fA,fB)) → đoạn đường cần đi
6. Trả về GeoJSON của sub-line này
```

**SQL raw tương đương:**
```sql
SELECT ST_AsGeoJSON(
    ST_LineSubstring(
        ST_LineMerge(path),
        ST_LineLocatePoint(ST_LineMerge(path), stop_a_geom),
        ST_LineLocatePoint(ST_LineMerge(path), stop_b_geom)
    )
) FROM routes_busroute WHERE id = 1;
```

**Code thêm vào views.py:**
```python
from django.db import connection

def get_sub_route_geometry(route, origin_stop, dest_stop):
    """Cắt đoạn đường từ stop A đến stop B bằng PostGIS."""
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT ST_AsGeoJSON(
                ST_LineSubstring(
                    ST_LineMerge(r.path),
                    LEAST(
                        ST_LineLocatePoint(ST_LineMerge(r.path), s1.location),
                        ST_LineLocatePoint(ST_LineMerge(r.path), s2.location)
                    ),
                    GREATEST(
                        ST_LineLocatePoint(ST_LineMerge(r.path), s1.location),
                        ST_LineLocatePoint(ST_LineMerge(r.path), s2.location)
                    )
                )
            )
            FROM routes_busroute r, routes_busstop s1, routes_busstop s2
            WHERE r.id = %s AND s1.id = %s AND s2.id = %s
        """, [route.id, origin_stop.id, dest_stop.id])
        row = cursor.fetchone()
        return json.loads(row[0]) if row and row[0] else None
```

Thêm field `sub_route_geometry` vào RouteSearchResultSerializer.

### D. Bug: sequence = 0 trong import_geojson

Hiện tại RouteStop.sequence luôn = 0 vì import_geojson không set nó.

Cần sửa `_import_stops` để tính sequence dựa trên thứ tự trạm dọc theo tuyến:
```python
# Sau khi tất cả stops của 1 route được import:
# Tính sequence bằng ST_LineLocatePoint cho từng stop
# Sort theo fraction → đó là sequence đúng
```

### E. Tóm tắt những điều cần hiểu để build tiếp

1. **GeoJSON từ OSM**: Route = geometry đường đi thực tế. Stop = điểm bên lề đường. Liên kết = @relations.
2. **MultiLineString**: Tổng hợp từ nhiều đoạn đường OSM, không liên quan đến trạm.
3. **Bán kính tìm trạm** (default 500m): Quan trọng - quá nhỏ thì miss, quá lớn thì nhầm tuyến.
4. **Sub-route**: Cần ST_LineMerge + ST_LineLocatePoint + ST_LineSubstring (PostGIS chức năng cao cấp).
5. **Sequence**: Hiện bị bug (= 0). Cần tính lại sau khi import.
6. **Chiều tuyến**: 09A có 2 chiều (đi/về) = 2 BusRoute riêng → API có thể trả về cả 2.

---

## Files cần đọc kỹ khi viết tài liệu
- `backend/routes/models.py` - 3 model, PostGIS fields
- `backend/routes/views.py` - logic find_routes (3 bước)
- `backend/routes/management/commands/import_geojson.py` - cách parse @relations
- `tay-ho-datas.geojson` - cấu trúc dữ liệu thực
