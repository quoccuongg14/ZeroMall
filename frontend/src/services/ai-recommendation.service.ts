import { API_BASE_URL } from '../config/api.config';
import { queryClient } from '../config/queryClient';

export interface PersonalizedFeedResponse {
  products: any[];
  total: number;
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
  userProfile: {
    isPersonalized: boolean;
    detectedGender?: string;
    topInterests: string[];
    topKeywords?: string[];
    preferredPriceRange?: number;
    hasRecentInteractions: boolean;
    recentAction?: string;
  };
}

export function getGuestId(): string | null {
  try {
    return localStorage.getItem('zm_guest_id') || sessionStorage.getItem('zm_guest_id');
  } catch {
    return null;
  }
}

/**
 * Lấy mã định danh người dùng nhất quán (Hỗ trợ cả User đã đăng nhập & Khách vãng lai Guest)
 */
export function getEffectiveUserId(): string {
  try {
    const rawUser = localStorage.getItem('zm_user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u?.id) return u.id;
    }
  } catch {}

  let guestId = getGuestId();
  if (!guestId) {
    guestId = 'guest_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('zm_guest_id', guestId);
    sessionStorage.setItem('zm_guest_id', guestId);
  }
  return guestId;
}

/**
 * Gộp lịch sử hành vi từ Guest sang tài khoản User ngay khi đăng nhập / đăng ký thành công
 */
export async function mergeGuestBehaviorToUser(userId?: string): Promise<void> {
  if (!userId) return;
  const guestId = getGuestId();
  if (!guestId || guestId === userId || !guestId.startsWith('guest_')) return;

  try {
    await fetch(`${API_BASE_URL}/products/ai/merge-guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ guestId, userId }),
    });
    localStorage.removeItem('zm_guest_id');
    sessionStorage.removeItem('zm_guest_id');
    queryClient.invalidateQueries({ queryKey: ['products', 'personalized_feed'] });
  } catch {
    // Non-blocking
  }
}

/**
 * Gửi sự kiện hành vi người dùng lên AI Recommendation Engine
 * (Kích hoạt khi Xem sản phẩm, Thêm vào giỏ, Thả tim, Tìm kiếm, Mua hàng)
 */
export async function trackUserEngagement(
  action: 'VIEW' | 'CART' | 'LIKE' | 'PURCHASE' | 'SEARCH',
  productId?: string,
  category?: string,
  metadata?: any
): Promise<void> {
  try {
    const userId = getEffectiveUserId();

    await fetch(`${API_BASE_URL}/products/ai/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: action === 'PURCHASE',
      body: JSON.stringify({
        userId,
        action,
        productId,
        category,
        metadata,
      }),
    });

    // Làm mới feed gợi ý ngay lập tức khi người dùng quay về trang chủ / trang Gợi ý
    queryClient.invalidateQueries({ queryKey: ['products', 'personalized_feed'] });
  } catch {
    // Non-blocking error handling
  }
}

/**
 * Lấy danh sách sản phẩm gợi ý cá nhân hóa từ ZeroAI ("Gợi Ý Hôm Nay" / Daily Discover)
 */
export async function getPersonalizedRecommendations(
  userId?: string,
  gender?: string,
  limit: number = 30,
  page: number = 1
): Promise<PersonalizedFeedResponse | null> {
  try {
    const effectiveUserId = userId || getEffectiveUserId();

    const params = new URLSearchParams();
    if (effectiveUserId) params.set('userId', effectiveUserId);
    if (gender) params.set('gender', gender);
    params.set('limit', limit.toString());
    params.set('page', page.toString());

    const res = await fetch(`${API_BASE_URL}/products/ai/recommendations?${params.toString()}`);
    if (res.ok) {
      return (await res.json()) as PersonalizedFeedResponse;
    }
    return null;
  } catch (e) {
    console.warn('Lỗi lấy gợi ý AI:', e);
    return null;
  }
}
