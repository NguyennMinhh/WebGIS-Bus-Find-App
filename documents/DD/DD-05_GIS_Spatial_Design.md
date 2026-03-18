# DD-05 — GIS & Spatial Design

> **Loại tài liệu:** Design Document
> **Phiên bản:** 1.0
> **Cập nhật lần cuối:** 2026-03-18
> **Trạng thái:** Draft

---

## 1. Tổng Quan Kiến Trúc GIS

Dự án sử dụng **3 lớp GIS** độc lập nhau:

```
┌────────────────────────────────────────────────┐
│  Frontend (OpenLayers)                         │
│  - Hiển thị bản đồ tương tác                   │
│  - Render WMS tiles từ GeoServer               │
│  - Coordinate system: EPSG:3857 (Web Mercator) │
└──────────────────┬─────────────────────────────┘
                   │ WMS request (HTTP)
┌──────────────────▼─────────────────────────────┐
│  GeoServer                                     │
│  - Map tile server (WMS/WFS)                   │
│  - Render spatial data thành ảnh PNG           │
│  - Style với SLD (Styled Layer Descriptor)     │
│  - Connect trực tiếp tới PostGIS               │
└──────────────────┬─────────────────────────────┘
                   │ SQL query (JDBC)
┌──────────────────▼─────────────────────────────┐
│  PostGIS (PostgreSQL extension)                │
│  - Lưu trữ dữ liệu không gian                  │
│  - Spatial indexes (GIST)                      │
│  - Spatial functions (ST_*)                    │
│  - Coordinate system: EPSG:4326 (WGS84)        │
└────────────────────────────────────────────────┘
```

---

## 2. Hệ Tọa Độ (CRS — Coordinate Reference Systems)

### 2.1 EPSG:4326 — WGS84

**Mô tả:** Hệ tọa độ địa lý (geographic), đơn vị là **độ** (degrees)
**Format:** `(longitude, latitude)` — X trước, Y sau
**Ví dụ Hà Nội:** `(105.8412, 21.0245)`

**Dùng ở đâu trong dự án:**
- Lưu trữ trong PostGIS: `SRID=4326`
- GeoJSON format: chuẩn là WGS84
- OSM data: dùng WGS84

```python
# Django/GeoDjango
from django.contrib.gis.geos import Point, GEOSGeometry
point = Point(105.8046867, 21.055715, srid=4326)  # (lng, lat)
```

---

### 2.2 EPSG:3857 — Web Mercator (Spherical Mercator)

**Mô tả:** Hệ tọa độ chiếu (projected), đơn vị là **mét**
**Đặc điểm:** Bóp méo diện tích ở vĩ độ cao, nhưng phù hợp cho web mapping
**Ví dụ Hà Nội:** `(11782576, 2391272)` (mét)

**Dùng ở đâu trong dự án:**
- OpenLayers: mặc định dùng EPSG:3857 cho `View`
- OSM tiles: sử dụng EPSG:3857
- GeoServer WMS: tự convert khi request

```typescript
// OpenLayers
import { fromLonLat } from 'ol/proj'
const center = fromLonLat([105.8412, 21.0245])  // [lng, lat] WGS84 → EPSG:3857
// Result: [11782576, 2391272]
```

---

### 2.3 Sơ đồ chuyển đổi CRS

```
OSM Overpass API
    ↓ GeoJSON (EPSG:4326)
import_geojson.py
    ↓ GEOSGeometry(srid=4326)
PostGIS (SRID=4326)
    ↓ JDBC connection
GeoServer
    ↓ Render → PNG với EPSG:3857 projection
OpenLayers ImageWMS Layer
    ↓ Hiển thị trên EPSG:3857 map view
Browser
```

---

## 3. OpenLayers — Chi Tiết Kỹ Thuật

### 3.1 Layer Stack

```typescript
// Thứ tự render (dưới → trên):
const layers = [
  osmLayer,       // 1. Base map (TileLayer)
  busRoutesLayer, // 2. Bus routes (ImageLayer/WMS)
  busStopsLayer,  // 3. Bus stops (ImageLayer/WMS)
]
```

### 3.2 TileLayer vs ImageLayer

| | `TileLayer` | `ImageLayer` |
|--|-------------|-------------|
| Nguồn | `OSM`, `XYZ` | `ImageWMS`, `ImageStatic` |
| Cách tải | Nhiều tile nhỏ 256×256px | 1 ảnh lớn cho toàn viewport |
| Caching | Browser cache từng tile | Request mới khi zoom/pan |
| Dùng cho | Base maps (OSM) | Dynamic WMS layers |
| Hiệu năng | Tốt hơn (cache tiles) | Kém hơn nhưng đơn giản |

**Tại sao dùng `ImageLayer` cho WMS?**
- GeoServer có thể render ảnh theo bất kỳ BBOX nào
- Không cần tile grid chuẩn
- Đơn giản hơn khi cấu hình
- Với dữ liệu ít layer như dự án này: đủ tốt

**Khi nào nên dùng `TileWMS`?**
- Dataset lớn, nhiều người dùng đồng thời
- GeoServer đã cấu hình tile cache (GWC)
- Cần performance tốt hơn

### 3.3 ImageWMS Parameters

```typescript
const source = new ImageWMS({
  url: 'http://localhost:8600/geoserver/busrouting/wms',
  params: {
    LAYERS: 'busrouting:routes_busroute',
    SERVICE: 'WMS',
    VERSION: '1.1.1',   // Hoặc '1.3.0' (khác biệt: axis order)
    FORMAT: 'image/png',
    TRANSPARENT: true   // Bắt buộc để nhìn xuyên layer
  },
  ratio: 1,             // 1 = ảnh vừa viewport; >1 = ảnh lớn hơn (giảm re-request)
  serverType: 'geoserver'  // Tối ưu cho GeoServer
})
```

**WMS 1.1.1 vs 1.3.0:**
- 1.1.1: BBOX format = `minX,minY,maxX,maxY` (lng_min,lat_min,lng_max,lat_max)
- 1.3.0: BBOX format flipped cho EPSG:4326 = `lat_min,lng_min,lat_max,lng_max`
- Dự án dùng 1.1.1 để tránh confusion

---

## 4. GeoServer — Cấu Hình

### 4.1 Workspace và Layers

```
GeoServer
└── Workspace: busrouting
    └── Store: busrouting_postgis (PostGIS connection)
        ├── Layer: routes_busroute  (bảng routes_busroute)
        └── Layer: routes_busstop   (bảng routes_busstop)
```

### 4.2 Cấu hình PostGIS Store

```
Connection type: PostGIS
Host: db           (Docker service name)
Port: 5432
Database: busrouting
User: postgres
Password: postgres
```

**Lưu ý:** Trong Docker network, GeoServer kết nối DB qua hostname `db`, không phải `localhost`.

### 4.3 SLD Styling

GeoServer sử dụng **SLD (Styled Layer Descriptor)** để định dạng cách render spatial data.

**Default style cho bus routes (ví dụ):**
```xml
<StyledLayerDescriptor>
  <NamedLayer>
    <Name>routes_busroute</Name>
    <UserStyle>
      <FeatureTypeStyle>
        <Rule>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#0000FF</CssParameter>  <!-- Màu xanh -->
              <CssParameter name="stroke-width">2</CssParameter>
            </Stroke>
          </LineSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
```

**Default style cho bus stops (ví dụ):**
```xml
<PointSymbolizer>
  <Graphic>
    <Mark>
      <WellKnownName>circle</WellKnownName>
      <Fill><CssParameter name="fill">#FF0000</CssParameter></Fill>  <!-- Màu đỏ -->
    </Mark>
    <Size>8</Size>
  </Graphic>
</PointSymbolizer>
```

---

## 5. PostGIS — Spatial Functions

### 5.1 Các Hàm Dùng Trong Dự Án

#### `ST_LineMerge(geometry)`

```sql
-- Input: MULTILINESTRING((0 0, 1 1), (1 1, 2 2))
-- Output: LINESTRING(0 0, 1 1, 2 2)

SELECT ST_GeometryType(ST_LineMerge(path)) FROM routes_busroute WHERE id = 1;
-- Kết quả: 'ST_LineString' (nếu merge được) hoặc 'ST_MultiLineString' (nếu không liên tục)
```

**Khi nào không merge được?**
- Các đoạn không chia sẻ điểm đầu/cuối (gap giữa các đoạn)
- Route vòng tròn (khởi đầu = kết thúc)
- Dữ liệu OSM có lỗi

---

#### `ST_LineLocatePoint(linestring, point)`

```sql
-- Điểm dừng ở đâu trên tuyến xe buýt?
SELECT ST_LineLocatePoint(
  ST_LineMerge(r.path),        -- Tuyến xe buýt (đã merge thành LineString)
  s.location                   -- Điểm dừng (Point)
) AS fraction
FROM routes_busroute r, routes_busstop s
WHERE r.id = 1 AND s.id = 5;

-- Ví dụ kết quả: 0.123456 (điểm dừng ở vị trí 12.3% của tuyến)
```

**Lưu ý:** Không nhất thiết phải nằm trên đường — hàm tính điểm chiếu vuông góc gần nhất trên line.

---

#### `ST_LineSubstring(linestring, start_frac, end_frac)`

```sql
-- Lấy đoạn đường từ điểm dừng A đến điểm dừng B
SELECT ST_AsGeoJSON(
  ST_LineSubstring(
    ST_LineMerge(r.path),
    0.123,   -- fraction của điểm dừng A
    0.789    -- fraction của điểm dừng B
  )
) AS sub_route
FROM routes_busroute r WHERE id = 1;
```

---

#### `ST_DWithin(geom_a, geom_b, distance)`

```sql
-- Tìm điểm dừng trong phạm vi 500m của tọa độ người dùng
SELECT s.*
FROM routes_busstop s
WHERE ST_DWithin(
  s.location::geography,                       -- Convert sang geography (tính bằng mét)
  ST_MakePoint(105.8412, 21.0245)::geography,  -- Tọa độ người dùng
  500                                          -- 500 mét
);
```

**`::geography` vs `::geometry`:**
- `geometry`: tính khoảng cách theo đơn vị của CRS (degrees nếu EPSG:4326)
- `geography`: tính khoảng cách theo mét (geodesic distance trên bề mặt trái đất)
- Dùng `::geography` khi cần kết quả chính xác theo mét

---

#### `ST_AsGeoJSON(geometry)`

```sql
-- Convert PostGIS geometry → GeoJSON string
SELECT ST_AsGeoJSON(path) FROM routes_busroute WHERE id = 1;
-- Output: '{"type":"MultiLineString","coordinates":[[[105.80,21.05],...]]}'
```

**Dùng để:** Serialize geometry trong API response.

---

#### `ST_Distance(geom_a, geom_b)`

```sql
-- Khoảng cách (mét) giữa 2 điểm
SELECT ST_Distance(
  s.location::geography,
  ST_MakePoint(105.8412, 21.0245)::geography
) AS distance_meters
FROM routes_busstop s WHERE id = 5;
```

---

### 5.2 Geometry Operations Workflow (Route Finding — F-12)

```
Input: from_stop_id = 5, to_stop_id = 12

Step 1: Tìm route có cả 2 điểm dừng
  SELECT r.id FROM routes_busroute r
  JOIN routes_routestop rs1 ON rs1.route_id = r.id AND rs1.stop_id = 5
  JOIN routes_routestop rs2 ON rs2.route_id = r.id AND rs2.stop_id = 12
  WHERE rs1.sequence < rs2.sequence
  → route_id = 1

Step 2: Tính fraction của from_stop
  SELECT ST_LineLocatePoint(ST_LineMerge(path), (SELECT location FROM routes_busstop WHERE id=5))
  FROM routes_busroute WHERE id = 1
  → from_frac = 0.123

Step 3: Tính fraction của to_stop
  SELECT ST_LineLocatePoint(ST_LineMerge(path), (SELECT location FROM routes_busstop WHERE id=12))
  FROM routes_busroute WHERE id = 1
  → to_frac = 0.789

Step 4: Lấy sub-route geometry
  SELECT ST_AsGeoJSON(ST_LineSubstring(ST_LineMerge(path), 0.123, 0.789))
  FROM routes_busroute WHERE id = 1
  → GeoJSON LineString

Step 5: Lấy danh sách điểm dừng trung gian
  SELECT s.*, rs.sequence
  FROM routes_busstop s
  JOIN routes_routestop rs ON rs.stop_id = s.id
  WHERE rs.route_id = 1
    AND rs.sequence BETWEEN 1 AND 8  -- sequence của from và to
  ORDER BY rs.sequence
```

---

## 6. OpenStreetMap Data Structure

### 6.1 Overpass API Output Format

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "relation/12726060",
      "properties": {
        "@id": "relation/12726060",
        "@relations": [],
        "type": "route",
        "route": "bus",
        "ref": "09A",
        "name": "Tuyến 09A: ...",
        "from": "Bờ Hồ",
        "to": "Đại học Mỏ",
        "operator": "...",
        "opening_hours": "Mo-Su 05:00-21:30",
        "charge": "10000 VND",
        "interval": "00:15-00:20"
      },
      "geometry": {
        "type": "MultiLineString",
        "coordinates": [[[105.80, 21.05], [105.81, 21.06], ...]]
      }
    },
    {
      "type": "Feature",
      "id": "node/8741294713",
      "properties": {
        "@id": "node/8741294713",
        "@relations": [
          {"rel": 12726060, "role": "stop"},  // Điểm dừng này thuộc tuyến 12726060
          {"rel": 12726061, "role": "stop"}   // Và tuyến 12726061
        ],
        "name": "Đối diện Nhà hàng Ngọc Được 3",
        "highway": "bus_stop"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [105.8046867, 21.055715]  // [longitude, latitude]
      }
    }
  ]
}
```

### 6.2 OSM Data Quirks Cần Biết

**1. Route geometry là tổng hợp từ nhiều OSM ways**
- Mỗi đoạn đường (way) trong OSM là 1 LineString
- Overpass gộp tất cả ways của route → MultiLineString
- Thứ tự trong MultiLineString có thể không theo chiều đi

**2. Một số route chỉ có LineString (1 way)**
- Xử lý: wrap thành MultiLineString khi import
- Code: `'coordinates': [coords]`

**3. Điểm dừng không nằm chính xác trên đường tuyến**
- OSM stops là nodes riêng, không phải điểm trên way
- `ST_LineLocatePoint` vẫn hoạt động: tính điểm chiếu gần nhất
- Khoảng cách offset nhỏ (vài chục mét) là bình thường

**4. `@relations` chứa nhiều tuyến**
- Một điểm dừng có thể phục vụ nhiều tuyến
- `@relations` là array, loop qua tất cả để tạo RouteStop

---

## 7. Spatial Index Strategy

### 7.1 GeoDjango tự tạo GIST index

Khi khai báo spatial fields trong models:
```python
path     = models.MultiLineStringField(srid=4326)  # → tự tạo GIST index
location = models.PointField(srid=4326)             # → tự tạo GIST index
```

Migration sẽ sinh:
```sql
CREATE INDEX routes_busroute_path_id ON routes_busroute USING GIST (path);
CREATE INDEX routes_busstop_location_id ON routes_busstop USING GIST (location);
```

### 7.2 Khi nào index được sử dụng?

| Query | Dùng index? |
|-------|-------------|
| `ST_DWithin(location, point, radius)` | ✅ Có |
| `ST_Intersects(path, bbox)` | ✅ Có |
| `ST_Contains(region, location)` | ✅ Có |
| `ST_LineLocatePoint(...)` | ❌ Không (hàm tính toán) |
| `ST_Distance(...)` không có DWithin | ❌ Không |

**Kết luận:** Các query tìm kiếm spatial (bounding box, distance) được tăng tốc bởi index. Các hàm tính toán thuần túy không dùng index.
