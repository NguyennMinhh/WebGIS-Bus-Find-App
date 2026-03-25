// =============================================================================
// api.ts — HTTP client cho Django REST API
// Thêm các hàm gọi API vào đây khi code tính năng
// =============================================================================

import type { LngLat, FindRouteResult } from '../types'

const BASE_URL = import.meta.env.VITE_API_URL as string

/** Helper: gọi GET và parse JSON */
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

/** Helper: gọi POST và parse JSON */
async function post<TBody, TResponse>(path: string, body: TBody): Promise<TResponse> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<TResponse>
}

export const api = {
  get,
  findRoute(origin: LngLat, destination: LngLat, radius: number): Promise<FindRouteResult[]> {
    return post('/find-route/', { origin, destination, radius })
  },
}