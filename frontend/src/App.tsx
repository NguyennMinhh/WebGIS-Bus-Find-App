import Header from './components/layout/Header'
import { MapView } from './components/map'

/**
 * App — Root component.
 *
 * Layout:
 *   - Header: fixed, z-10, không che map
 *   - MapView: chiếm toàn màn hình (position absolute, inset-0)
 *
 * Tất cả tính năng mới (search, sidebar, panels) sẽ được thêm
 * như các overlay component nằm trên MapView.
 */
const App = () => {
  return (
    <div className="relative w-full h-full">
      {/* Map ở dưới cùng, chiếm toàn màn hình */}
      <div className="absolute inset-0">
        <MapView />
      </div>

      {/* Header overlay phía trên map */}
      <Header />
    </div>
  )
}

export default App
