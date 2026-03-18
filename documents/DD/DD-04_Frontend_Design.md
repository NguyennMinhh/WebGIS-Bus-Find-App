# DD-04 — Thiết Kế Frontend

> **Loại tài liệu:** Design Document
> **Phiên bản:** 1.0
> **Cập nhật lần cuối:** 2026-03-18
> **Trạng thái:** Draft

---

## 1. Cấu Trúc Thư Mục Frontend

```
frontend/
├── src/
│   ├── App.tsx                      # Root component — layout chính
│   ├── main.tsx                     # React entry point
│   │
│   ├── components/                  # UI Components
│   │   ├── layout/
│   │   │   └── Header.tsx           # Navigation header cố định
│   │   └── map/
│   │       ├── MapView.tsx          # OpenLayers map container
│   │       └── index.ts             # Barrel export
│   │
│   ├── hooks/
│   │   └── useMap.ts                # Custom hook: khởi tạo bản đồ OpenLayers
│   │
│   ├── services/
│   │   └── api.ts                   # HTTP client (GET helper)
│   │
│   ├── types/
│   │   └── index.ts                 # TypeScript interfaces
│   │
│   ├── utils/
│   │   └── mapConfig.ts             # Cấu hình bản đồ (URL GeoServer, tên layers)
│   │
│   └── styles/
│       └── globals.css              # Tailwind directives + global styles
│
├── index.html                        # HTML entry point
├── vite.config.ts                    # Vite build configuration
├── tsconfig.json                     # TypeScript configuration
├── tailwind.config.js                # Tailwind CSS configuration
├── postcss.config.js                 # PostCSS configuration
└── package.json                      # Dependencies
```

---

## 2. Component Tree

```
main.tsx
└── <App />
    ├── <Header />          (fixed, z-10, trên cùng)
    └── <MapView />         (absolute inset-0, chiếm full screen)
         └── useMap(ref)    (hook quản lý OpenLayers)
               ├── TileLayer (OSM base map)
               ├── ImageLayer (WMS: bus routes)
               └── ImageLayer (WMS: bus stops)
```

---

## 3. Chi Tiết Từng File

### 3.1 `App.tsx` — Root Component

**File:** [frontend/src/App.tsx](../../frontend/src/App.tsx)

```tsx
function App() {
  return (
    <div className="relative w-full h-screen overflow-hidden">
      <Header />       {/* fixed, z-10 — luôn ở trên */}
      <MapView />      {/* absolute inset-0 — chiếm toàn màn hình */}
    </div>
  )
}
```

**Thiết kế layout:**
- Container: `relative` + `overflow-hidden` — để `absolute` child hoạt động đúng
- `h-screen`: chiều cao bằng viewport
- Header dùng `fixed` + `z-10` để đè lên map
- MapView dùng `absolute inset-0` (top=0, right=0, bottom=0, left=0) = full screen

---

### 3.2 `Header.tsx` — Navigation Bar

**File:** [frontend/src/components/layout/Header.tsx](../../frontend/src/components/layout/Header.tsx)

**Trạng thái:** Hiển thị tiêu đề tĩnh. Chưa có chức năng tương tác.

**Styling:**
- `fixed top-0 left-0 right-0` — cố định ở đầu trang
- `z-10` — đè lên bản đồ
- `bg-white/90 backdrop-blur-sm` — nền trắng trong suốt 90%, blur phía sau
- `shadow-md` — đổ bóng để tách khỏi map

**Kế hoạch mở rộng (TODO):**
- Thêm `SearchBar` component (tìm kiếm tuyến)
- Thêm `LayerToggle` component (bật/tắt layer)
- Thêm `RouteInfoPanel` (hiển thị khi click tuyến)

---

### 3.3 `MapView.tsx` — Map Container

**File:** [frontend/src/components/map/MapView.tsx](../../frontend/src/components/map/MapView.tsx)

```tsx
function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  useMap(containerRef)  // Hook quản lý toàn bộ OpenLayers logic

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
    />
  )
}
```

**Trách nhiệm:**
- Tạo và truyền `ref` cho DOM element
- Gọi `useMap` hook để khởi tạo bản đồ
- Không chứa bất kỳ logic bản đồ nào — chỉ là "container"

**Pattern:** Container/Logic separation — component chỉ quản lý DOM container, toàn bộ OpenLayers logic ở trong hook.

---

### 3.4 `useMap.ts` — Map Initialization Hook

**File:** [frontend/src/hooks/useMap.ts](../../frontend/src/hooks/useMap.ts)

Đây là file quan trọng nhất trong frontend — chứa toàn bộ logic khởi tạo bản đồ.

**Signature:**
```typescript
function useMap(targetRef: React.RefObject<HTMLDivElement | null>): void
```

**Luồng khởi tạo:**

```typescript
useEffect(() => {
  // Guard: không khởi tạo lại nếu đã có map
  if (!targetRef.current || mapRef.current) return

  // Layer 1: OpenStreetMap base map
  const osmLayer = new TileLayer({
    source: new OSM()
  })

  // Layer 2: Bus Routes (WMS từ GeoServer)
  const busRoutesLayer = new ImageLayer({
    source: new ImageWMS({
      url: GEOSERVER_WMS_URL,          // http://localhost:8600/geoserver/busrouting/wms
      params: {
        LAYERS: LAYER_BUS_ROUTES,      // busrouting:routes_busroute
        SERVICE: 'WMS',
        VERSION: '1.1.1',
        FORMAT: 'image/png',
        TRANSPARENT: true
      },
      ratio: 1,
      serverType: 'geoserver'
    })
  })

  // Layer 3: Bus Stops (WMS từ GeoServer)
  const busStopsLayer = new ImageLayer({
    source: new ImageWMS({
      url: GEOSERVER_WMS_URL,
      params: {
        LAYERS: LAYER_BUS_STOPS,       // busrouting:routes_busstop
        SERVICE: 'WMS',
        VERSION: '1.1.1',
        FORMAT: 'image/png',
        TRANSPARENT: true
      },
      ratio: 1,
      serverType: 'geoserver'
    })
  })

  // Tạo Map
  const map = new OlMap({
    target: targetRef.current,
    layers: [osmLayer, busRoutesLayer, busStopsLayer],
    view: new View({
      center: fromLonLat([MAP_CENTER[0], MAP_CENTER[1]]),  // [105.8412, 21.0245] → EPSG:3857
      zoom: MAP_ZOOM,  // 12
    }),
  })

  mapRef.current = map

  // Cleanup: hủy bản đồ khi component unmount
  return () => {
    map.setTarget(undefined)
    mapRef.current = null
  }
}, [targetRef])
```

**Điểm quan trọng:**

1. **Guard pattern:** `if (!targetRef.current || mapRef.current) return`
   - Tránh khởi tạo map 2 lần trong React StrictMode (dev mode gọi useEffect 2 lần)
   - `mapRef.current` lưu instance map giữa các render

2. **Layer thứ tự:** OSM (dưới cùng) → Routes (giữa) → Stops (trên cùng)
   - OpenLayers render layer theo thứ tự trong mảng
   - Layer đầu tiên hiển thị dưới cùng

3. **`fromLonLat([lng, lat])`:** Convert từ EPSG:4326 sang EPSG:3857
   - OpenLayers mặc định dùng EPSG:3857 (Web Mercator) cho view
   - WGS84 coordinates cần convert trước khi dùng làm center

4. **WMS format:** `image/png` với `TRANSPARENT: true`
   - PNG hỗ trợ kênh alpha (transparency)
   - Cho phép nhìn xuyên qua layer WMS để thấy layer phía dưới
   - Quan trọng: nếu dùng `image/jpeg` thì không có transparency

5. **Cleanup function:** `map.setTarget(undefined)` + `mapRef.current = null`
   - `setTarget(undefined)` = ngắt map khỏi DOM element, giải phóng event listeners
   - Bắt buộc để tránh memory leak khi component unmount

---

### 3.5 `mapConfig.ts` — Map Configuration

**File:** [frontend/src/utils/mapConfig.ts](../../frontend/src/utils/mapConfig.ts)

```typescript
// Tọa độ trung tâm mặc định: khu vực Hồ Tây, Hà Nội
export const MAP_CENTER: [number, number] = [105.8412, 21.0245]

// Zoom level: 12 = nhìn được cả quận
export const MAP_ZOOM = 12

// GeoServer WMS endpoint
const GEOSERVER_BASE = import.meta.env.VITE_GEOSERVER_URL  || 'http://localhost:8600/geoserver'
const WORKSPACE      = import.meta.env.VITE_GEOSERVER_WORKSPACE || 'busrouting'
export const GEOSERVER_WMS_URL = `${GEOSERVER_BASE}/${WORKSPACE}/wms`

// Layer names (phải khớp với tên layer trong GeoServer)
export const LAYER_BUS_ROUTES = `${WORKSPACE}:routes_busroute`
export const LAYER_BUS_STOPS  = `${WORKSPACE}:routes_busstop`
```

**Environment variables:**

| Biến | Default | Mô tả |
|------|---------|-------|
| `VITE_GEOSERVER_URL` | `http://localhost:8600/geoserver` | GeoServer base URL |
| `VITE_GEOSERVER_WORKSPACE` | `busrouting` | GeoServer workspace name |
| `VITE_API_URL` | `http://localhost:8000/api` | Django backend API URL |

**Lưu ý `VITE_` prefix:**
- Vite chỉ expose env vars có prefix `VITE_` ra client code
- Truy cập bằng `import.meta.env.VITE_...` (không phải `process.env`)
- Các biến không có `VITE_` prefix sẽ không khả dụng trong browser

---

### 3.6 `api.ts` — HTTP Client

**File:** [frontend/src/services/api.ts](../../frontend/src/services/api.ts)

```typescript
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export const api = {
  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return response.json() as Promise<T>
  }
}
```

**Sử dụng:**
```typescript
// Ví dụ sử dụng sau khi API endpoint được implement
const routes = await api.get<BusRoute[]>('/routes/')
const route  = await api.get<BusRoute>(`/routes/${id}/`)
```

**Kế hoạch mở rộng:** Thêm `post`, `put`, `delete` khi cần.

---

### 3.7 `types/index.ts` — TypeScript Types

**File:** [frontend/src/types/index.ts](../../frontend/src/types/index.ts)

```typescript
type LngLat = [number, number]  // [longitude, latitude]

interface RouteGeometry {
  type: 'MultiLineString' | 'LineString'
  coordinates: LngLat[] | LngLat[][]
}

interface BusRoute {
  id: number
  ref: string               // "09A"
  name: string              // "Trần Khánh Dư - ..."
  from_stop: string
  to_stop: string
  operator: string
  opening_hours: string
  charge: string
  interval: string
  geometry: RouteGeometry   // GeoJSON geometry
}

interface BusStop {
  id: number
  name: string
  lat: number
  lng: number
}
```

---

## 4. Styling System

### 4.1 Tailwind CSS

**Config:** [frontend/tailwind.config.js](../../frontend/tailwind.config.js)

- Scan: `./src/**/*.{ts,tsx}` — tự động xóa class không dùng (purge)
- Chưa có custom config (theme, colors, etc.)

### 4.2 Global Styles

**File:** [frontend/src/styles/globals.css](../../frontend/src/styles/globals.css)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  height: 100%;
  margin: 0;
  padding: 0;
}
```

**Quan trọng:** `height: 100%` cho `html`, `body`, `#root` là bắt buộc để `h-screen` hoạt động đúng với bản đồ full-screen.

### 4.3 OpenLayers CSS

Import trong `useMap.ts`:
```typescript
import 'ol/ol.css'
```

Cung cấp styles cho:
- Zoom control buttons
- Attribution text
- Map container cursor styles
- Popup overlays (nếu thêm sau)

---

## 5. Build & Development

### 5.1 Vite Configuration

**File:** [frontend/vite.config.ts](../../frontend/vite.config.ts)

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // Bind tất cả interfaces (cần thiết trong Docker)
    port: 5173,
  }
})
```

**`host: '0.0.0.0'`:** Bắt buộc khi chạy trong Docker — nếu bind `localhost` thì không thể access từ bên ngoài container.

### 5.2 npm Scripts

```json
{
  "scripts": {
    "dev":   "vite",                   // Dev server với hot reload
    "build": "tsc && vite build",      // Type check + production build
    "preview": "vite preview"          // Preview production build locally
  }
}
```

### 5.3 TypeScript Config

**File:** [frontend/tsconfig.json](../../frontend/tsconfig.json)

- `strict: true` — Bật strict type checking
- `target: ES2020` — Modern JS output
- `jsx: react-jsx` — Dùng React 17+ JSX transform (không cần `import React`)

---

## 6. Kế Hoạch Mở Rộng Frontend

### 6.1 Components cần thêm

```
components/
├── layout/
│   ├── Header.tsx          ✅ (hiện tại: tĩnh)
│   └── Sidebar.tsx         🔲 (panel thông tin tuyến)
├── map/
│   ├── MapView.tsx         ✅ (hiện tại: chỉ hiển thị)
│   ├── RouteLayer.tsx      🔲 (Vector layer cho tuyến đã chọn)
│   └── StopMarker.tsx      🔲 (Custom marker cho điểm dừng)
├── search/
│   └── SearchBar.tsx       🔲 (tìm kiếm tuyến)
└── panels/
    ├── RouteDetailPanel.tsx 🔲 (chi tiết tuyến)
    └── StopDetailPanel.tsx  🔲 (chi tiết điểm dừng)
```

### 6.2 Hooks cần thêm

```
hooks/
├── useMap.ts           ✅
├── useMapClick.ts      🔲 (xử lý click trên bản đồ)
├── useRoutes.ts        🔲 (fetch và cache danh sách tuyến)
└── useStops.ts         🔲 (fetch và cache danh sách điểm dừng)
```

### 6.3 State Management

Khi ứng dụng phức tạp hơn, cân nhắc:
- **React Context + useReducer:** Cho global state nhỏ (tuyến đang chọn, filter)
- **Zustand:** Lightweight, dễ dùng với TypeScript
- **TanStack Query (React Query):** Quản lý data fetching, caching, loading states
