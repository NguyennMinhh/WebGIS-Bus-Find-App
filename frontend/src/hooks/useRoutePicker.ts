import { useEffect, useRef, useState, useCallback } from 'react'
import Map from 'ol/Map'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import { fromLonLat, toLonLat } from 'ol/proj'
import { Style, Circle as CircleStyle, Fill, Stroke } from 'ol/style'
import type { MapBrowserEvent } from 'ol'

// Type alias: tuple 2 số [lng, lat]
export type LngLat = [number, number]
export type SelectionMode = 'origin' | 'destination' | null

// ─── Helper tạo style marker hình tròn ───────────────────────────────────────
// Hàm thuần (không phải hook) — gọi ngoài component được
function createMarkerStyle(color: string) {
  return new Style({
    image: new CircleStyle({
      radius: 8,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: '#fff', width: 2 }),
    }),
  })
}

// Tạo style 1 lần, tái dùng — không cần tạo lại mỗi render
const ORIGIN_STYLE = createMarkerStyle('#2563eb')       // xanh
const DESTINATION_STYLE = createMarkerStyle('#dc2626')  // đỏ

// Interface data đầu vào
interface UseRoutePickerParams {
  mapRef: React.MutableRefObject<Map | null>  // useRef<Map | null>(null) từ MapView
  selectionMode: SelectionMode
  setSelectionMode: (mode: SelectionMode) => void
}

// ─── Hook chính ──────────────────────────────────────────────────────────────
export function useRoutePicker({ mapRef, selectionMode, setSelectionMode }: UseRoutePickerParams) {

  // useState → reactive, khi thay đổi sẽ trigger re-render
  const [origin, setOrigin] = useState<LngLat | null>(null)
  const [destination, setDestination] = useState<LngLat | null>(null)

  // useRef → KHÔNG trigger re-render, dùng để giữ object OL
  // (tương đương shallowRef không reactive trong Vue3)
  const layerRef = useRef<VectorLayer | null>(null)
  const originFeature = useRef(new Feature())       // Feature OL để vẽ marker
  const destinationFeature = useRef(new Feature())

  // Lazy init: chỉ tạo layer 1 lần khi lần đầu gọi
  function getLayer() {
    if (!layerRef.current) {
      originFeature.current.setStyle(ORIGIN_STYLE)
      destinationFeature.current.setStyle(DESTINATION_STYLE)

      layerRef.current = new VectorLayer({
        source: new VectorSource({
          features: [originFeature.current, destinationFeature.current],
        }),
        zIndex: 100,  // nổi trên WMS layers
      })
    }
    return layerRef.current
  }

  // Đặt geometry Point vào Feature → marker hiện trên bản đồ
  function placeMarker(feature: Feature, lngLat: LngLat) {
    // fromLonLat chuyển EPSG:4326 → EPSG:3857 (web mercator mà OL dùng)
    feature.setGeometry(new Point(fromLonLat(lngLat)))
  }

  function removeMarker(feature: Feature) {
    feature.setGeometry(undefined)  // undefined = ẩn marker
  }

  // ─── Effect 1: Thêm/xóa layer khi map ready ────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const layer = getLayer()
    map.addLayer(layer)

    return () => { map.removeLayer(layer) }
  }, [mapRef.current])

  // ─── Effect 2: Attach/detach click listener theo selectionMode ─────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectionMode) return

    const el = map.getTargetElement() as HTMLElement
    el.style.cursor = 'crosshair'   // đổi cursor khi đang chọn điểm

    function handleClick(e: MapBrowserEvent<PointerEvent>) {
      // toLonLat: EPSG:3857 → EPSG:4326 [lng, lat]
      const lngLat = toLonLat(e.coordinate) as LngLat

      if (selectionMode === 'origin') {
        placeMarker(originFeature.current, lngLat)
        setOrigin(lngLat)
      } else {
        placeMarker(destinationFeature.current, lngLat)
        setDestination(lngLat)
      }

      setSelectionMode(null)  // tắt mode → effect sẽ cleanup
    }

    map.on('singleclick', handleClick as any)

    // Cleanup: chạy khi selectionMode thay đổi hoặc component unmount
    return () => {
      el.style.cursor = ''
      map.un('singleclick', handleClick as any)   // un = removeEventListener của OL
    }
  }, [selectionMode])

  // ─── useCallback — memoize functions ──────────────────────────────────────
  const handleSetOrigin = useCallback((lngLat: LngLat) => {
    placeMarker(originFeature.current, lngLat)
    setOrigin(lngLat)
  }, []) 

  const handleSetDestination = useCallback((lngLat: LngLat) => {
    placeMarker(destinationFeature.current, lngLat)
    setDestination(lngLat)
  }, [])

  // ─── GPS Location ──────────────────────────────────────────────────────────
  const getGPSLocation = useCallback(() => {
    return new Promise<LngLat>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lngLat: LngLat = [pos.coords.longitude, pos.coords.latitude]
          handleSetOrigin(lngLat)
          // Pan bản đồ đến vị trí GPS với animation
          mapRef.current?.getView().animate({ center: fromLonLat(lngLat), zoom: 15 })
          resolve(lngLat)
        },
        reject,
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })
  }, [])

  // ─── Clear tất cả ─────────────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    setOrigin(null)
    setDestination(null)
    removeMarker(originFeature.current)
    removeMarker(destinationFeature.current)
  }, [])

  // API công khai của hook
  return {
    origin,
    destination,
    setOrigin: handleSetOrigin,
    setDestination: handleSetDestination,
    getGPSLocation,
    clearAll,
  }
}