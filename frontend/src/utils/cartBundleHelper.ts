import type { Product } from '../components/buyer/FlashSale'

export interface AddBundleResult {
  addedCount: number
  skippedCount: number
  bundleKeys: string[]
}

/**
 * Thêm trọn bộ các sản phẩm trong một Set phối đồ vào giỏ hàng,
 * đồng thời cập nhật danh sách chọn (zm_selected_keys) để khi vào Giỏ hàng
 * chỉ tự động tick chọn đúng các món thuộc Set này (không chọn lẫn các đồ khác).
 */
export function addOutfitBundleToCart(
  products: Product[],
  variant: string,
  onAddToCart: (product: Product, quantity: number, variant: string) => void
): AddBundleResult {
  const uniqueMap = new Map<string, Product>()
  for (const p of products) {
    if (p && p.id && !uniqueMap.has(p.id)) {
      uniqueMap.set(p.id, p)
    }
  }

  const validProducts: Product[] = []
  let skippedCount = 0

  for (const prod of uniqueMap.values()) {
    const stockVal =
      prod.stock !== undefined
        ? prod.stock
        : prod.total !== undefined
        ? prod.total - (prod.sold || 0)
        : 99
    if (stockVal <= 0 || prod.status === 'hidden') {
      skippedCount++
      continue
    }
    validProducts.push(prod)
  }

  const cleanVariant = variant || 'Size Tiêu Chuẩn'
  const bundleKeys: string[] = []

  for (const prod of validProducts) {
    onAddToCart(prod, 1, cleanVariant)
    bundleKeys.push(`${prod.id}#${cleanVariant}`)
  }

  if (bundleKeys.length > 0) {
    try {
      localStorage.setItem('zm_selected_keys', JSON.stringify(bundleKeys))
      window.dispatchEvent(new CustomEvent('zm_selected_keys_updated', { detail: bundleKeys }))
    } catch (e) {
      console.warn('[addOutfitBundleToCart] Failed to update zm_selected_keys:', e)
    }
  }

  return {
    addedCount: validProducts.length,
    skippedCount,
    bundleKeys,
  }
}
