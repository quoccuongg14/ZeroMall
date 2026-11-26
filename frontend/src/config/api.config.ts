/**
 * Cấu hình API URL trung tâm cho toàn bộ Frontend ZeroMall.
 * 
 * Khi deploy production: set biến VITE_API_URL trong .env
 * Ví dụ: VITE_API_URL=https://api.zeromall.vn
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/**
 * Cấu hình cổng dịch vụ Phòng thử đồ AI Virtual Try-On
 */
export const TRYON_SERVICE_URL = import.meta.env.VITE_TRYON_SERVICE_URL || 'http://localhost:5006'

/**
 * URL cổng ZeroMall Express Delivery theo môi trường đang chạy
 * (local `.local` giữ subdomain riêng, production/Vercel dùng chung origin `/delivery`).
 */
export function getDeliveryPortalUrl(): string {
  if (typeof window === 'undefined') return '/delivery'
  if (window.location.hostname.endsWith('.local')) {
    return `${window.location.protocol}//delivery.zeromall.local${window.location.port ? `:${window.location.port}` : ''}`
  }
  return `${window.location.origin}/delivery`
}
