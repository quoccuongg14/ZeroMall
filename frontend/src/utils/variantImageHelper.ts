import type { Product, VariationGroup, VariationRow } from '../components/buyer/FlashSale'
import { parseProductVariations } from './sizePredictor'

export interface ProductColorVariant {
  name: string
  image: string
  price?: number
  originalPrice?: number
  inStock: boolean
  stockCount: number
}

function parsePriceValue(val: unknown): number | undefined {
  if (typeof val === 'number' && !isNaN(val) && val > 0) return val
  if (typeof val === 'string') {
    const cleaned = parseFloat(val.replace(/[^0-9.]/g, ''))
    if (!isNaN(cleaned) && cleaned > 0) return cleaned
  }
  return undefined
}

function findRowForOption(rows: VariationRow[], groupIdx: number, optName: string): VariationRow | undefined {
  const optLower = optName.trim().toLowerCase()
  return rows.find((r) => {
    const parts = (r.name || r.key || '')
      .split(/[-,/]/)
      .map((s) => s.trim().toLowerCase())
    return (
      parts[groupIdx] === optLower ||
      (r.name || r.key || '').toLowerCase() === optLower
    )
  })
}

/**
 * Lấy danh sách biến thể có ảnh riêng (Màu sắc / Kiểu dáng ở tier đầu tiên của sản phẩm)
 */
export function getProductColorVariants(product: Product | null | undefined): ProductColorVariant[] {
  if (!product) return []
  const { groups, rows } = parseProductVariations(product)
  if (groups.length === 0) return []

  // Tìm group đóng vai trò Màu sắc / Kiểu dáng (ưu tiên group có trường images hoặc tên chứa màu/kiểu/phân loại)
  let colorGroupIdx = groups.findIndex((g: VariationGroup) => {
    const imgs = (g as any)?.images
    return imgs && Object.keys(imgs).length > 0
  })
  if (colorGroupIdx < 0) {
    colorGroupIdx = groups.findIndex((g: VariationGroup) => /(màu|color|kiểu|mẫu|phân loại)/i.test(g?.name || ''))
  }
  if (colorGroupIdx < 0) return []

  const targetGroup = groups[colorGroupIdx]
  if (!Array.isArray(targetGroup?.options) || targetGroup.options.length === 0) return []

  const variants: ProductColorVariant[] = []
  for (const rawOpt of targetGroup.options) {
    const opt = String(rawOpt)
    const groupImg = (targetGroup as any).images?.[opt]
    const matchingRows = rows.filter((r) => {
      const parts = (r.name || r.key || '').split(/[-,/]/).map((s) => s.trim().toLowerCase())
      return parts[colorGroupIdx] === opt.trim().toLowerCase()
    })
    const rowWithImg = matchingRows.find((r) => Boolean(r.image)) || findRowForOption(rows, colorGroupIdx, opt)
    const image = groupImg || rowWithImg?.image || product.image || ''

    const totalStock = matchingRows.length > 0
      ? matchingRows.reduce((sum, r) => sum + (parseInt(String(r.stock), 10) || 0), 0)
      : (typeof product.stock === 'number' ? product.stock : 99)

    const firstPricedRow = matchingRows.find((r) => parsePriceValue(r.price) !== undefined)
    variants.push({
      name: opt,
      image,
      price: parsePriceValue(firstPricedRow?.price),
      originalPrice: parsePriceValue(firstPricedRow?.originalPrice),
      inStock: totalStock > 0,
      stockCount: totalStock,
    })
  }

  // Chỉ trả về nếu có ít nhất 1 biến thể mang ảnh hoặc nhiều hơn 1 tùy chọn màu
  const hasDistinctVariantImages = variants.some((v) => v.image && v.image !== product.image) || variants.length > 1
  return hasDistinctVariantImages ? variants : []
}

/**
 * Tạo bản sao Product mang đúng ảnh, giá và tên biến thể màu đang chọn
 */
export function getEffectiveProductForColor(
  product: Product,
  selectedColorName?: string,
): Product & { selectedVariant?: string } {
  const variants = getProductColorVariants(product)
  if (variants.length === 0) return product

  const matched = selectedColorName
    ? variants.find((v) => v.name.toLowerCase() === selectedColorName.toLowerCase())
    : variants[0]

  if (!matched) return product

  return {
    ...product,
    image: matched.image || product.image,
    price: matched.price !== undefined ? String(matched.price) : product.price,
    originalPrice: matched.originalPrice !== undefined ? String(matched.originalPrice) : product.originalPrice,
    selectedVariant: matched.name,
  }
}

/**
 * Trích xuất tên màu tier 1 từ chuỗi biến thể đầy đủ (vd "Đen - L" -> "Đen")
 */
export function extractColorFromVariantString(product: Product, fullVariant?: string): string | undefined {
  if (!fullVariant) return undefined
  const variants = getProductColorVariants(product)
  if (variants.length === 0) return undefined
  const tokens = fullVariant.split(/[-,/]/).map((s) => s.trim().toLowerCase()).filter(Boolean)
  const found = variants.find((v) => tokens.includes(v.name.toLowerCase()) || fullVariant.toLowerCase().includes(v.name.toLowerCase()))
  return found?.name
}

/**
 * Ghép chuẩn chuỗi phân loại khi thêm giỏ hàng / mua ngay (hỗ trợ 1 hoặc 2 tầng: Màu + Size)
 */
export function composeVariantSelection(
  product: Product,
  colorName?: string,
  sizeName?: string,
): string {
  const { groups, rows } = parseProductVariations(product)
  const cleanColor = (colorName || '').trim()
  const cleanSize = (sizeName || '').trim()

  if (rows.length > 0) {
    const exactBoth = rows.find((r) => {
      const parts = (r.name || r.key || '').split(/[-,/]/).map((s) => s.trim().toLowerCase())
      const hasC = !cleanColor || parts.includes(cleanColor.toLowerCase())
      const hasS = !cleanSize || parts.includes(cleanSize.toLowerCase())
      return hasC && hasS
    })
    if (exactBoth) return String(exactBoth.name || exactBoth.key)
  }

  if (groups.length >= 2 && cleanColor && cleanSize) {
    const g0IsColor = /(màu|color|kiểu|mẫu)/i.test(groups[0]?.name || '') || Boolean((groups[0] as any)?.images)
    return g0IsColor ? `${cleanColor} - ${cleanSize}` : `${cleanSize} - ${cleanColor}`
  }

  if (cleanColor && cleanSize && cleanColor.toLowerCase() !== cleanSize.toLowerCase() && cleanSize !== 'Freesize') {
    return `${cleanColor} - ${cleanSize}`
  }

  return cleanSize || cleanColor || 'Freesize'
}
