// frontend/src/components/map/RouteSearchPanel.tsx

import type { LngLat, FindRouteResult } from '../../types'
import type { SelectionMode } from '../../hooks/useRoutePicker'

interface Props {
  origin: LngLat | null
  destination: LngLat | null
  selectionMode: SelectionMode
  results: FindRouteResult[]
  loading: boolean
  onSetSelectionMode: (mode: SelectionMode) => void
  onSearch: () => void
  onGPS: () => void
  onClear: () => void
}

// ─── Helper hiển thị tọa độ ──────────────────────────────────────────────────
function formatCoord(lngLat: LngLat | null): string {
  if (!lngLat) return 'Chưa chọn'
  return `${lngLat[0].toFixed(4)}, ${lngLat[1].toFixed(4)}`
}

// ─── Sub-component: 1 hàng điểm ──────────────────────────────────────────────
interface PointRowProps {
  label: string
  color: string          // 'blue' | 'red'
  lngLat: LngLat | null
  isActive: boolean      // đang trong selection mode không?
  onPick: () => void
  onGPS?: () => void
}

const PointRow = ({ label, color, lngLat, isActive, onPick, onGPS }: PointRowProps) => {
  const dot = color === 'blue' ? '🔵' : '🔴'

  // Nút đổi màu khi đang active (đang chờ user click bản đồ)
  const pickBtnClass = isActive
    ? 'bg-blue-500 text-white px-2 py-1 rounded text-sm'
    : 'bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-sm'

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-4">{dot}</span>
      <span className="text-xs text-gray-500 w-16 shrink-0">{label}</span>

      {/* Tọa độ — flex-1 để chiếm hết không gian còn lại */}
      <span className="flex-1 text-xs font-mono text-gray-700">
        {formatCoord(lngLat)}
      </span>

      {/* Nút chọn trên bản đồ */}
      <button onClick={onPick} className={pickBtnClass} title="Chọn trên bản đồ">
        Click
      </button>

      {/* Nút GPS — chỉ render khi có prop onGPS */}
      {onGPS && (
        <button
          onClick={onGPS}
          className="bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-sm"
          title="Dùng vị trí hiện tại"
        >
          GPS
        </button>
      )}
    </div>
  )
}

// ─── Component chính ──────────────────────────────────────────────────────────
const RouteSearchPanel = ({
  origin,
  destination,
  selectionMode,
  results,
  loading,
  onSetSelectionMode,
  onSearch,
  onGPS,
  onClear,
}: Props) => {
  const canSearch = origin !== null && destination !== null && !loading

  return (
    // absolute: nổi trên bản đồ (bản đồ dùng position: relative)
    <div className="absolute bottom-8 left-4 z-20 w-80 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-4">

      {/* ── Hàng điểm đi ── */}
      <PointRow
        label="Điểm đi"
        color="blue"
        lngLat={origin}
        isActive={selectionMode === 'origin'}
        onPick={() => onSetSelectionMode('origin')}
        onGPS={onGPS}
      />

      {/* ── Hàng điểm đến ── */}
      <PointRow
        label="Điểm đến"
        color="red"
        lngLat={destination}
        isActive={selectionMode === 'destination'}
        onPick={() => onSetSelectionMode('destination')}
      />

      <hr className="my-3" />

      {/* ── Nút tìm tuyến ── */}
      <div className="flex gap-2">
        <button
          onClick={onSearch}
          disabled={!canSearch}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300
                     text-white font-medium py-2 rounded-lg text-sm transition-colors"
        >
          {loading ? 'Đang tìm...' : 'Tìm tuyến xe buýt'}
        </button>

        {/* Nút xóa — chỉ hiện khi có ít nhất 1 điểm */}
        {(origin || destination) && (
          <button
            onClick={onClear}
            className="px-3 py-2 text-gray-500 hover:text-red-500 rounded-lg"
            title="Xóa"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Danh sách kết quả ── */}
      {results.length > 0 && (
        <div className="mt-3 max-h-60 overflow-y-auto">
          <p className="text-xs text-gray-500 mb-2">
            Tìm thấy {results.length} tuyến:
          </p>

          {/* Key bắt buộc để React tracking DOM efficiently */}
          {results.map(route => (
            <RouteCard key={route.id} route={route} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sub-component: 1 card kết quả ───────────────────────────────────────────
const RouteCard = ({ route }: { route: FindRouteResult }) => (
  <div className="border border-gray-200 rounded-lg p-3 mb-2 hover:bg-gray-50">
    {/* Tuyến số + tên */}
    <p className="font-semibold text-sm">
      Tuyến {route.ref}
      {route.name && <span className="font-normal text-gray-600"> — {route.name}</span>}
    </p>

    {/* Điểm lên/xuống */}
    <p className="text-xs text-gray-500 mt-1">
      🟢 Lên: <span className="text-gray-700">{route.board_stop.name}</span>
    </p>
    <p className="text-xs text-gray-500">
      🔴 Xuống: <span className="text-gray-700">{route.alight_stop.name}</span>
    </p>

    {/* Thông tin thêm */}
    <div className="flex gap-3 mt-1">
      {route.charge && (
        <span className="text-xs text-green-600">Phí {route.charge}</span>
      )}
      {route.interval && (
        <span className="text-xs text-blue-600">Thời gian {route.interval}</span>
      )}
    </div>
  </div>
)

export default RouteSearchPanel