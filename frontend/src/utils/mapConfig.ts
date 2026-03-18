// =============================================================================
// mapConfig.ts — Cấu hình OpenLayers Map
// Thay đổi CENTER/ZOOM ở đây nếu muốn điều chỉnh view mặc định
// =============================================================================

/** Center mặc định: Hà Nội (trung tâm khu vực Tây Hồ) */
export const MAP_CENTER: [number, number] = [105.8412, 21.0245]

/** Zoom mặc định (12 = xem rõ cấp quận) */
export const MAP_ZOOM = 12

/** Projection mặc định của OpenLayers (Web Mercator) */
export const MAP_PROJECTION = 'EPSG:3857'

// =============================================================================
// GeoServer config — đọc từ biến môi trường VITE_
// =============================================================================
const GEOSERVER_BASE = import.meta.env.VITE_GEOSERVER_URL as string
const WORKSPACE      = import.meta.env.VITE_GEOSERVER_WORKSPACE as string

/** URL WMS endpoint của GeoServer */
export const GEOSERVER_WMS_URL = `${GEOSERVER_BASE}/${WORKSPACE}/wms`

/** Tên layer tuyến xe (phải khớp với layer name đã publish trong GeoServer) */
export const LAYER_BUS_ROUTES = `${WORKSPACE}:routes_busroute`

/** Tên layer trạm dừng */
export const LAYER_BUS_STOPS = `${WORKSPACE}:routes_busstop`
