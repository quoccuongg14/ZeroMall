import type { Product, VariationGroup, VariationRow } from '../components/buyer/FlashSale'

export interface BodyProfile {
  heightCm: number
  weightKg: number
  gender: 'male' | 'female'
}

export interface SizePredictionResult {
  applicable: boolean
  recommendedSize: string
  alternativeSize: string | null
  groupName: string
  groupIndex: number
  availableOptions: string[]
  inStock: boolean
  chestCm: number
  waistCm: number
  hipCm: number
  bmi: number
  note: string
}

const SIZE_LETTERS_MALE = ['S', 'M', 'L', 'XL', 'XXL']
const SIZE_LETTERS_FEMALE = ['S', 'M', 'L', 'XL']

export function loadSavedBodyProfile(): BodyProfile {
  try {
    const h = Number(localStorage.getItem('zeromall_tryon_user_height')) || 175
    const w = Number(localStorage.getItem('zeromall_tryon_user_weight')) || 68
    const g = localStorage.getItem('zeromall_tryon_user_gender') === 'female' ? 'female' : 'male'
    return {
      heightCm: Math.min(220, Math.max(120, h)),
      weightKg: Math.min(150, Math.max(30, w)),
      gender: g,
    }
  } catch {
    return { heightCm: 175, weightKg: 68, gender: 'male' }
  }
}

export function saveBodyProfile(profile: Partial<BodyProfile>): void {
  try {
    if (profile.heightCm !== undefined) {
      localStorage.setItem('zeromall_tryon_user_height', String(profile.heightCm))
    }
    if (profile.weightKg !== undefined) {
      localStorage.setItem('zeromall_tryon_user_weight', String(profile.weightKg))
    }
    if (profile.gender !== undefined) {
      localStorage.setItem('zeromall_tryon_user_gender', profile.gender)
    }
  } catch {
    // Bỏ qua lỗi quota storage
  }
}

export function parseProductVariations(product: Product): {
  groups: VariationGroup[]
  rows: VariationRow[]
} {
  let groups: VariationGroup[] = []
  let rows: VariationRow[] = []

  try {
    const rawG: any = product.variationGroups
    groups = typeof rawG === 'string' ? JSON.parse(rawG) : Array.isArray(rawG) ? rawG : []
  } catch {
    groups = []
  }

  try {
    const rawR: any = product.variationRows
    rows = typeof rawR === 'string' ? JSON.parse(rawR) : Array.isArray(rawR) ? rawR : []
  } catch {
    rows = []
  }

  if (groups.length === 0 && Array.isArray(product.variants) && product.variants.length > 0) {
    groups = [{ name: 'Phân loại', options: product.variants }]
  }

  return { groups, rows }
}

function estimateMeasurements(heightCm: number, weightKg: number, gender: 'male' | 'female') {
  const hM = Math.max(1, heightCm / 100)
  const bmi = Number((weightKg / (hM * hM)).toFixed(1))

  if (gender === 'female') {
    return {
      bmi,
      chestCm: Number((0.48 * heightCm + 0.18 * weightKg).toFixed(1)),
      waistCm: Number((0.33 * heightCm + 0.25 * weightKg).toFixed(1)),
      hipCm: Number((0.44 * heightCm + 0.42 * weightKg).toFixed(1)),
    }
  }

  return {
    bmi,
    chestCm: Number((0.53 * heightCm + 0.1 * weightKg).toFixed(1)),
    waistCm: Number((0.38 * heightCm + 0.22 * weightKg).toFixed(1)),
    hipCm: Number((0.45 * heightCm + 0.25 * weightKg).toFixed(1)),
  }
}

function checkOptionStock(opt: string, groupIdx: number, rows: VariationRow[]): boolean {
  if (rows.length === 0) return true
  const optLower = opt.trim().toLowerCase()
  return rows.some((r) => {
    const parts = (r.name || r.key || '')
      .split(/[-,/]/)
      .map((s) => s.trim().toLowerCase())
    const matches = parts[groupIdx] === optLower || (r.name || r.key || '').toLowerCase() === optLower
    return matches && (parseInt(String(r.stock), 10) || 0) > 0
  })
}

/**
 * Dự đoán Size phù hợp nhất với chiều cao, cân nặng, giới tính và đúng danh sách Size thực tế của sản phẩm
 */
export function predictProductSize(params: {
  product: Product
  heightCm: number
  weightKg: number
  gender: 'male' | 'female'
  isOuterLayer?: boolean
}): SizePredictionResult {
  const { product, heightCm, weightKg, gender, isOuterLayer = false } = params
  const h = Math.min(220, Math.max(120, Number(heightCm) || 175))
  const w = Math.min(150, Math.max(30, Number(weightKg) || 68))

  const effectiveGender: 'male' | 'female' = (() => {
    const nl = (product.name || '').toLowerCase()
    const cl = (product.category || '').toLowerCase()
    if (/(unisex|nam nữ|nam & nữ)/.test(nl)) return gender
    if ((nl.includes('nữ') || cl.includes('nữ')) && !nl.includes('nam')) return 'female'
    if ((nl.includes('nam') || cl.includes('nam')) && !nl.includes('nữ')) return 'male'
    return gender
  })()

  const { bmi, chestCm, waistCm, hipCm } = estimateMeasurements(h, w, effectiveGender)
  const { groups, rows } = parseProductVariations(product)

  const nameLower = (product.name || '').toLowerCase()
  const catLower = (product.category || '').toLowerCase()
  const isClothing = /(áo|quần|đầm|váy|blazer|vest|bomber|hoodie|cardigan|sơ mi|polo|thun|jogger|short)/.test(nameLower)
    || catLower.includes('thời trang')

  let groupIdx = 0
  let targetGroup: VariationGroup | undefined = groups[0]
  let matchedSizeGroup = false
  for (let i = 0; i < groups.length; i++) {
    const gName = (groups[i]?.name || '').toLowerCase()
    if (/(size|kích|dài|vòng|mặt|cỡ)/.test(gName)) {
      groupIdx = i
      targetGroup = groups[i]
      matchedSizeGroup = true
      break
    }
  }

  const targetGroupNameLower = (targetGroup?.name || '').toLowerCase()
  const isColorOnlyGroup = !matchedSizeGroup && /(màu|color)/.test(targetGroupNameLower) && isClothing
  const availableOptions: string[] = !isColorOnlyGroup && Array.isArray(targetGroup?.options)
    ? targetGroup!.options.map(String)
    : []
  const groupName = !isColorOnlyGroup ? (targetGroup?.name || 'Kích thước') : 'Kích thước'

  // Giày dép: không đoán số giày từ cân nặng
  if (catLower.includes('giày') || catLower.includes('dép') || /(giày|sneaker|boots|loafer|dép|sandal)/.test(nameLower)) {
    const fallbackOpt = availableOptions[Math.min(2, availableOptions.length - 1)] || ''
    return {
      applicable: false,
      recommendedSize: fallbackOpt,
      alternativeSize: null,
      groupName,
      groupIndex: groupIdx,
      availableOptions,
      inStock: fallbackOpt ? checkOptionStock(fallbackOpt, groupIdx, rows) : true,
      chestCm,
      waistCm,
      hipCm,
      bmi,
      note: 'Cỡ giày phụ thuộc chiều dài bàn chân (cm), hãy chọn đúng số giày bạn thường mang.',
    }
  }

  // Thắt lưng / Dây nịt
  if (/(thắt lưng|dây nịt)/.test(nameLower)) {
    let rec = waistCm < 76 ? '105cm' : waistCm < 84 ? '110cm' : waistCm < 92 ? '115cm' : '120cm'
    let alt: string | null = rec === '105cm' ? '110cm' : rec === '110cm' ? '115cm' : rec === '115cm' ? '120cm' : null
    if (availableOptions.length > 0 && !availableOptions.includes(rec)) {
      rec = availableOptions[Math.min(1, availableOptions.length - 1)]
      alt = null
    }
    return {
      applicable: true,
      recommendedSize: rec,
      alternativeSize: alt,
      groupName,
      groupIndex: groupIdx,
      availableOptions,
      inStock: checkOptionStock(rec, groupIdx, rows),
      chestCm,
      waistCm,
      hipCm,
      bmi,
      note: `Vòng eo ước tính ~${waistCm}cm phù hợp dây dài ${rec}` + (alt ? ` (chọn ${alt} nếu thích dư dây hơn)` : ''),
    }
  }

  // Đồng hồ
  if (catLower.includes('đồng hồ') || nameLower.includes('đồng hồ')) {
    let rec = availableOptions[0] || (effectiveGender === 'female' ? '28mm' : '40mm')
    let alt: string | null = null
    if (availableOptions.includes('28mm') && availableOptions.includes('32mm')) {
      rec = h >= 163 || w >= 55 ? '32mm' : '28mm'
      alt = rec === '32mm' ? '28mm' : '32mm'
    } else if (availableOptions.includes('40mm')) {
      rec = h >= 178 && w >= 72 && availableOptions.includes('42mm')
        ? '42mm'
        : h < 166 && w < 58 && availableOptions.includes('38mm')
          ? '38mm'
          : '40mm'
      alt = rec !== '40mm' ? '40mm' : null
    }
    return {
      applicable: true,
      recommendedSize: rec,
      alternativeSize: alt,
      groupName,
      groupIndex: groupIdx,
      availableOptions,
      inStock: checkOptionStock(rec, groupIdx, rows),
      chestCm,
      waistCm,
      hipCm,
      bmi,
      note: `Mặt ${rec} cân đối cổ tay cho thể trạng ${h}cm • ${w}kg.`,
    }
  }

  // Vòng tay
  if (nameLower.includes('vòng tay')) {
    let rec = effectiveGender === 'male' || w >= 68 ? '18cm' : w >= 52 ? '17cm' : '16cm'
    if (availableOptions.length > 0 && !availableOptions.includes(rec)) {
      rec = availableOptions[Math.min(1, availableOptions.length - 1)]
    }
    return {
      applicable: true,
      recommendedSize: rec,
      alternativeSize: null,
      groupName,
      groupIndex: groupIdx,
      availableOptions,
      inStock: checkOptionStock(rec, groupIdx, rows),
      chestCm,
      waistCm,
      hipCm,
      bmi,
      note: `Chu vi ${rec} vừa vặn cổ tay với thể trạng ${h}cm • ${w}kg.`,
    }
  }

  // Phụ kiện khác / Túi / Ví / Mũ / Kính / Dây chuyền
  if (!isClothing) {
    const defaultOpt = availableOptions[0] || 'Freesize'
    return {
      applicable: false,
      recommendedSize: defaultOpt,
      alternativeSize: null,
      groupName,
      groupIndex: groupIdx,
      availableOptions,
      inStock: true,
      chestCm,
      waistCm,
      hipCm,
      bmi,
      note: defaultOpt === 'Freesize'
        ? 'Phụ kiện Freesize — không cần chọn size theo chiều cao & cân nặng.'
        : 'Chọn phân loại phù hợp trước khi thêm vào giỏ.',
    }
  }

  // Bảng chỉ số Size form Việt Nam
  let baseIdx = 1
  let nearUpper = false
  let letters = SIZE_LETTERS_MALE

  if (effectiveGender === 'female') {
    letters = SIZE_LETTERS_FEMALE
    const hIdx = h < 156 ? 0 : h < 162 ? 1 : h < 168 ? 2 : 3
    const wIdx = w < 46 ? 0 : w < 53 ? 1 : w < 61 ? 2 : 3
    baseIdx = hIdx > wIdx ? Math.floor((hIdx + wIdx) / 2) : wIdx
    nearUpper =
      (wIdx >= hIdx && ((baseIdx === 0 && w >= 44) || (baseIdx === 1 && w >= 51) || (baseIdx === 2 && w >= 58))) ||
      hIdx > wIdx
  } else {
    letters = SIZE_LETTERS_MALE
    const hIdx = h < 164 ? 0 : h < 171 ? 1 : h < 177 ? 2 : h < 183 ? 3 : 4
    const wIdx = w < 56 ? 0 : w < 65 ? 1 : w < 74 ? 2 : w < 84 ? 3 : 4
    baseIdx = hIdx > wIdx ? Math.floor((hIdx + wIdx) / 2) : wIdx
    nearUpper =
      (wIdx >= hIdx &&
        ((baseIdx === 0 && w >= 54) || (baseIdx === 1 && w >= 63) || (baseIdx === 2 && w >= 71) || (baseIdx === 3 && w >= 80))) ||
      hIdx > wIdx
  }

  const normalizeSizeOpt = (s: string) => s.replace(/^size\s+/i, '').trim()

  // Quần có size số (29..34 / 26..30)
  const numericOpts = availableOptions.filter((o) => /^\d+$/.test(normalizeSizeOpt(o)))
  if (numericOpts.length > 0 || (/(quần jean|quần tây|quần âu|quần kaki)/.test(nameLower) && availableOptions.length === 0)) {
    const opts = numericOpts.length > 0
      ? numericOpts
      : effectiveGender === 'female'
        ? ['26', '27', '28', '29', '30']
        : ['29', '30', '31', '32', '34']
    const idx = Math.min(opts.length - 1, baseIdx)
    const rec = opts[idx]
    const alt = nearUpper && idx + 1 < opts.length ? opts[idx + 1] : idx > 0 && !nearUpper ? opts[idx - 1] : null
    return {
      applicable: true,
      recommendedSize: rec,
      alternativeSize: alt,
      groupName,
      groupIndex: groupIdx,
      availableOptions,
      inStock: checkOptionStock(rec, groupIdx, rows),
      chestCm,
      waistCm,
      hipCm,
      bmi,
      note:
        `Vòng eo ~${waistCm}cm (${h}cm • ${w}kg) mặc đẹp size ${rec}` +
        (alt && Number(normalizeSizeOpt(alt)) > Number(normalizeSizeOpt(rec)) ? ` • Muốn thoải mái chọn ${alt}.` : '.'),
    }
  }

  // Áo / Áo Khoác / Đầm / Váy / Jogger dùng size chữ
  const isOuter = isOuterLayer || /(áo khoác|bomber|blazer|vest|hoodie|cardigan|jacket)/.test(nameLower)
  const effIdx = Math.min(letters.length - 1, baseIdx + (isOuter && nearUpper ? 1 : 0))
  let rec = letters[effIdx]

  if (availableOptions.length > 0) {
    const exactMatch = availableOptions.find((o) => normalizeSizeOpt(o).toUpperCase() === rec.toUpperCase())
    if (exactMatch) {
      rec = exactMatch
    } else if (rec === 'XXL') {
      const xlMatch = availableOptions.find((o) => normalizeSizeOpt(o).toUpperCase() === 'XL')
      rec = xlMatch || availableOptions[Math.min(effIdx, availableOptions.length - 1)]
    } else {
      rec = availableOptions[Math.min(effIdx, availableOptions.length - 1)]
    }
  }

  let alt: string | null = null
  if (effIdx + 1 < letters.length) {
    const nextLetter = letters[effIdx + 1]
    if ((availableOptions.length === 0 || availableOptions.includes(nextLetter)) && (isOuter || nearUpper)) {
      alt = nextLetter
    }
  }

  return {
    applicable: true,
    recommendedSize: rec,
    alternativeSize: alt,
    groupName,
    groupIndex: groupIdx,
    availableOptions,
    inStock: checkOptionStock(rec, groupIdx, rows),
    chestCm,
    waistCm,
    hipCm,
    bmi,
    note:
      `${h}cm • ${w}kg (ngực ~${chestCm}cm, eo ~${waistCm}cm) → Size ${rec}` +
      (isOuter ? ' (đã tính độ rộng mặc lớp ngoài)' : '') +
      (alt ? ` • Thích rộng chọn ${alt}.` : '.'),
  }
}
