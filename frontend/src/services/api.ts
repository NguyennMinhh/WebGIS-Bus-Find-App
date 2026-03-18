// =============================================================================
// api.ts — HTTP client cho Django REST API
// Thêm các hàm gọi API vào đây khi code tính năng
// =============================================================================

const BASE_URL = import.meta.env.VITE_API_URL as string

/** Helper: gọi GET và parse JSON */
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export const api = { get }

// Ví dụ sẽ thêm sau:
// export const findRoutes = (params: FindRoutesParams) => ...
// export const getRouteDetail = (id: number) => ...
