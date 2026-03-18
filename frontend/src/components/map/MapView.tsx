import { useRef } from 'react'
import { useMap } from '../../hooks/useMap'

/**
 * MapView — Component hiển thị OpenLayers map.
 *
 * Chiếm toàn bộ không gian cha (w-full h-full).
 * Map được khởi tạo trong hook useMap, cleanup tự động khi unmount.
 *
 * Layers (theo thứ tự từ dưới lên):
 *   1. OSM base map
 *   2. WMS bus_routes (GeoServer)
 *   3. WMS bus_stops (GeoServer)
 */
const MapView = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  useMap(containerRef)

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      aria-label="Bản đồ tuyến xe buýt"
    />
  )
}

export default MapView
