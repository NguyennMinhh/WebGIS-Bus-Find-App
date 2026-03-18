import { useEffect, useRef } from 'react'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import ImageLayer from 'ol/layer/Image'
import ImageWMS from 'ol/source/ImageWMS'
import { fromLonLat } from 'ol/proj'
import 'ol/ol.css'

import {
  MAP_CENTER,
  MAP_ZOOM,
  GEOSERVER_WMS_URL,
  LAYER_BUS_ROUTES,
  LAYER_BUS_STOPS,
} from '../utils/mapConfig'

/**
 * useMap — Custom hook khởi tạo và quản lý OpenLayers Map instance.
 *
 * Cách dùng:
 *   const divRef = useRef<HTMLDivElement>(null)
 *   const { mapRef } = useMap(divRef)
 *   return <div ref={divRef} className="w-full h-full" />
 *
 * @param targetRef - ref gắn vào <div> container của map
 * @returns mapRef - ref tới Map instance (dùng để thêm layer, listener...)
 */
export const useMap = (targetRef: React.RefObject<HTMLDivElement>) => {
  const mapRef = useRef<Map | null>(null)

  useEffect(() => {
    // Guard: chỉ init 1 lần
    if (!targetRef.current || mapRef.current) return

    // ------------------------------------------------------------------
    // Layer 1: OSM base map (nền đường xá, tên địa danh)
    // ------------------------------------------------------------------
    const osmLayer = new TileLayer({
      source: new OSM(),
      properties: { name: 'osm-base' },
    })

    // ------------------------------------------------------------------
    // Layer 2: WMS — Tuyến xe buýt (từ GeoServer → PostGIS)
    // Chú ý: layer này chỉ hiển thị SAU KHI đã cấu hình GeoServer
    // ------------------------------------------------------------------
    const busRoutesLayer = new ImageLayer({
      source: new ImageWMS({
        url: GEOSERVER_WMS_URL,
        params: {
          LAYERS: LAYER_BUS_ROUTES,
          FORMAT: 'image/png',
          TRANSPARENT: true,
        },
        ratio: 1,
        serverType: 'geoserver',
      }),
      opacity: 0.8,
      properties: { name: 'bus-routes' },
    })

    // ------------------------------------------------------------------
    // Layer 3: WMS — Trạm dừng xe buýt
    // ------------------------------------------------------------------
    const busStopsLayer = new ImageLayer({
      source: new ImageWMS({
        url: GEOSERVER_WMS_URL,
        params: {
          LAYERS: LAYER_BUS_STOPS,
          FORMAT: 'image/png',
          TRANSPARENT: true,
        },
        ratio: 1,
        serverType: 'geoserver',
      }),
      properties: { name: 'bus-stops' },
    })

    // ------------------------------------------------------------------
    // Khởi tạo Map
    // fromLonLat([lng, lat]) chuyển từ WGS84 sang Web Mercator (EPSG:3857)
    // ------------------------------------------------------------------
    const map = new Map({
      target: targetRef.current,
      layers: [osmLayer, busRoutesLayer, busStopsLayer],
      view: new View({
        center: fromLonLat(MAP_CENTER),
        zoom: MAP_ZOOM,
      }),
    })

    mapRef.current = map

    // Cleanup khi component unmount
    return () => {
      map.setTarget(undefined)
      mapRef.current = null
    }
  }, [targetRef])

  return { mapRef }
}
