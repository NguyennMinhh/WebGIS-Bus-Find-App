// frontend/src/components/map/MapView.tsx

import { useRef, useState, useCallback } from 'react'
import { useMap } from '../../hooks/useMap'
import { useRoutePicker } from '../../hooks/useRoutePicker'
import type { SelectionMode } from '../../hooks/useRoutePicker'
import RouteSearchPanel from './RouteSearchPanel'
import { api } from '../../services/api'
import type { FindRouteResult } from '../../types'

const MapView = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  // ── State: chỉ những gì cần trigger re-render ────────────────────────────
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(null)
  const [results, setResults] = useState<FindRouteResult[]>([])
  const [loading, setLoading] = useState(false)

  // ── Khởi tạo bản đồ, lấy mapRef từ hook ─────────────────────────────────
  const { mapRef } = useMap(containerRef)

  // ── Hook quản lý markers + click + GPS ──────────────────────────────────
  const { origin, destination, getGPSLocation, clearAll } = useRoutePicker({
    mapRef,
    selectionMode,
    setSelectionMode,
  })

  // ── Handler gọi API tìm tuyến ─────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    if (!origin || !destination) return

    setLoading(true)
    setResults([])

    try {
      const data = await api.findRoute(origin, destination)
      setResults(data)
    } catch (err) {
      console.error('Tìm tuyến thất bại:', err)
    } finally {
      setLoading(false) 
    }
  }, [origin, destination])

  // ── Handler GPS ────────────────────────────────────────────────────────
  const handleGPS = useCallback(async () => {
    try {
      await getGPSLocation()
    } catch {
      alert('Không thể lấy vị trí GPS. Hãy cho phép trình duyệt truy cập vị trí.')
    }
  }, [getGPSLocation])

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    // relative: để RouteSearchPanel (absolute) định vị theo div này
    <div className="relative w-full h-full">

      {/* Bản đồ OL — chiếm toàn bộ không gian */}
      <div
        ref={containerRef}
        className="w-full h-full"
        aria-label="Bản đồ tuyến xe buýt"
      />

      {/* Panel nổi trên bản đồ */}
      <RouteSearchPanel
        origin={origin}
        destination={destination}
        selectionMode={selectionMode}
        results={results}
        loading={loading}
        onSetSelectionMode={setSelectionMode}
        onSearch={handleSearch}
        onGPS={handleGPS}
        onClear={clearAll}
      />
    </div>
  )
}

export default MapView