// =============================================================================
// Types / Interfaces cho WebGIS BusRouting
// Thêm type vào đây khi code các tính năng mới
// =============================================================================

/** Tọa độ địa lý [lng, lat] — theo chuẩn GeoJSON */
export type LngLat = [number, number]

/** GeoJSON geometry cho lộ trình tuyến xe */
export interface RouteGeometry {
  type: 'MultiLineString' | 'LineString'
  coordinates: LngLat[] | LngLat[][]
}

/** Một tuyến xe buýt */
export interface BusRoute {
  id: number
  ref: string           // Số tuyến: "09A", "50"
  name: string          // Tên đầy đủ
  from_stop: string
  to_stop: string
  operator: string
  opening_hours: string
  charge: string        // Giá vé: "10000 VND"
  interval: string      // Tần suất: "00:15-00:20"
  geometry: RouteGeometry
}

/** Một trạm dừng xe buýt */
export interface BusStop {
  id: number
  name: string
  lat: number
  lng: number
}
