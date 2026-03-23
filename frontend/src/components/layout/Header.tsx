/**
 * Header — Thanh điều hướng phía trên bản đồ.
 * Hiện tại chỉ hiển thị tiêu đề.
 * Sau này thêm SearchBar, LayerControl vào đây.
 */
const Header = () => {
  return (
    <header className="absolute top-0 left-0 right-0 z-10 flex items-center h-14 px-4 bg-white/90 backdrop-blur-sm shadow-sm">
      <h1 className="text-lg font-semibold text-gray-800">
        WebGIS — Tuyến xe buýt
      </h1>

      {/* TODO: Thêm SearchBar, LayerControl, UserMenu ở đây */}
    </header>
  )
}

export default Header
