import type { Product } from '../components/buyer/FlashSale'

export interface AddBundleResult {
  addedCount: number
  skippedCount: number
  bundleKeys: string[]
}

function resolveBundleItemVariant(prod: Product, preferredVariant: string): string {
  const rawPreferred = (preferredVariant || '').trim()
  const preferredSizeToken = rawPreferred.replace(/^Size\s+/i, '').trim().toLowerCase()
  const isGenericFallback = !rawPreferred || rawPreferred === 'Size Tiêu Chuẩn'

  let groups: any[] = []
  let rows: any[] = []
  try {
    groups = typeof prod.variationGroups === 'string'
      ? JSON.parse(prod.variationGroups)
      : Array.isArray(prod.variationGroups) ? prod.variationGroups : []
  } catch {}
  try {
    rows = typeof prod.variationRows === 'string'
      ? JSON.parse(prod.variationRows)
      : Array.isArray(prod.variationRows) ? prod.variationRows : []
  } catch {}

  const inStockRows = rows.filter((r) => (parseInt(String(r?.stock ?? 0), 10) || 0) > 0)
  const candidateRows = inStockRows.length > 0 ? inStockRows : rows

  if (candidateRows.length > 0) {
    // 1. Khớp trực tiếp theo size gợi ý (ví dụ S, M, L, XL) nếu sản phẩm có đúng option đó
    if (!isGenericFallback && preferredSizeToken) {
      const exactMatch = candidateRows.find((r) => {
        const label = String(r.name || r.key || '').trim().toLowerCase()
        return label === preferredSizeToken || label === rawPreferred.toLowerCase()
      })
      if (exactMatch) {
        return String(exactMatch.name || exactMatch.key)
      }
      // Map size chữ (S/M/L/XL) sang size số quần hoặc giày tương ứng
      const sizeIndexMap: Record<string, number> = { s: 0, m: 1, l: 2, xl: 3, xxl: 4 }
      if (preferredSizeToken in sizeIndexMap) {
        const targetIdx = Math.min(sizeIndexMap[preferredSizeToken], candidateRows.length - 1)
        const mapped = candidateRows[targetIdx]
        if (mapped) return String(mapped.name || mapped.key)
      }
    }

    // 2. Lấy phân loại phổ thông ở giữa (hoặc đầu tiên còn hàng)
    const midRow = candidateRows[Math.min(1, candidateRows.length - 1)]
    return String(midRow.name || midRow.key || 'Size Tiêu Chuẩn')
  }

  if (groups.length > 0) {
    const picked = groups
      .map((g) => {
        const opts: string[] = Array.isArray(g?.options) ? g.options : []
        if (!isGenericFallback && preferredSizeToken) {
          const found = opts.find((o) => o.trim().toLowerCase() === preferredSizeToken)
          if (found) return found
        }
        return opts[Math.min(1, opts.length - 1)] || opts[0] || ''
      })
      .filter(Boolean)
    if (picked.length > 0) return picked.join(' - ')
  }

  const prodNameLower = (prod.name || '').toLowerCase()
  const isFreeSizeAccessory = /(dây chuyền|vòng cổ|mũ|nón|kính|túi|ví|cài tóc|bông tai)/.test(prodNameLower)
  if (isFreeSizeAccessory) return 'Freesize'

  return rawPreferred || 'Size Tiêu Chuẩn'
}

/**
 * Thêm trọn bộ các sản phẩm trong một Set phối đồ vào giỏ hàng,
 * đồng thời cập nhật danh sách chọn (zm_selected_keys) để khi vào Giỏ hàng
 * chỉ tự động tick chọn đúng các món thuộc Set này (không chọn lẫn các đồ khác).
 */
export function addOutfitBundleToCart(
  products: Product[],
  variant: string,
  onAddToCart: (product: Product, quantity: number, variant: string) => void,
  perItemVariants?: Record<string, string>
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

  const bundleKeys: string[] = []

  for (const prod of validProducts) {
    const chosenVariant = perItemVariants?.[prod.id] || resolveBundleItemVariant(prod, variant)
    onAddToCart(prod, 1, chosenVariant)
    bundleKeys.push(`${prod.id}#${chosenVariant}`)
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
