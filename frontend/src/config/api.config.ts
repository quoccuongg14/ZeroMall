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

const PORTAL_SUBDOMAIN_RE = /^(seller|admin|delivery)\./

function isSingleHostEnvironment(hostname: string): boolean {
  return (
    !hostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.vercel.app') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  )
}

function getRootDomain(hostname: string): string {
  return hostname.replace(/^(seller|admin|delivery|www)\./, '')
}

/**
 * URL trang chủ Sàn TMĐT (Buyer) theo tên miền hiện tại.
 * - Trên subdomain (`seller.*`, `admin.*`, `delivery.*`): chuyển về trang chủ sàn gốc (`zeromall.local` hoặc `www.zeromall.id.vn`).
 * - Trên host đơn (`localhost`, `*.vercel.app`, hoặc đã ở trang chính): trả về `'/'`.
 */
export function getBuyerHomeUrl(): string {
  if (typeof window === 'undefined') return '/'
  const { hostname, port, protocol } = window.location
  const portSuffix = port ? `:${port}` : ''

  if (hostname.endsWith('.zeromall.local') || hostname === 'zeromall.local') {
    return `${protocol}//zeromall.local${portSuffix}/`
  }

  if (PORTAL_SUBDOMAIN_RE.test(hostname) && !isSingleHostEnvironment(hostname)) {
    const rootDomain = getRootDomain(hostname)
    return `${protocol}//www.${rootDomain}${portSuffix}/`
  }

  return '/'
}

/**
 * Mở trang chi tiết Shop ngoài Sàn TMĐT trong tab mới.
 * Nếu đang đứng ở subdomain Portal (`admin.*`, `seller.*`, `delivery.*`) thì mở sang domain Buyer kèm SSO params (nếu có).
 */
export function openShopStorefront(shopId: string): void {
  if (typeof window === 'undefined') return
  const { hostname } = window.location
  const isPortalSubdomain = PORTAL_SUBDOMAIN_RE.test(hostname) && !isSingleHostEnvironment(hostname)

  if (isPortalSubdomain) {
    const buyerBase = getBuyerHomeUrl().replace(/\/$/, '')
    const rawUser = localStorage.getItem('zm_user') || ''
    const rawToken = localStorage.getItem('zm_token') || ''
    const query = rawUser && rawToken
      ? `?sso_user=${encodeURIComponent(rawUser)}&sso_token=${encodeURIComponent(rawToken)}`
      : ''
    window.open(`${buyerBase}/shop/${shopId}${query}`, '_blank')
    return
  }

  window.open(`/shop/${shopId}`, '_blank')
}

/**
 * URL cổng ZeroMall Express Delivery theo môi trường đang chạy
 * (local/single-host dùng `/delivery`, hệ subdomain `.local` / `.id.vn` dùng `delivery.<rootDomain>`).
 */
export function getDeliveryPortalUrl(): string {
  if (typeof window === 'undefined') return '/delivery'
  const { hostname, port, protocol, origin } = window.location
  if (isSingleHostEnvironment(hostname)) {
    return `${origin}/delivery`
  }
  const rootDomain = getRootDomain(hostname)
  return `${protocol}//delivery.${rootDomain}${port ? `:${port}` : ''}`
}
