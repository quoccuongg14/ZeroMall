import React, { useState, useMemo, useEffect } from 'react'
import type { Product } from '../../FlashSale'
import type { CartFashionItem, OutfitSlots, OutfitSlotKey } from './types'
import {
  detectItemSlot,
  isProductMatchingGender,
  isOuterwearProduct,
  detectAccessoryZone,
  getAccessoryZoneLabel,
  flattenOutfitItems,
} from './tryonUtils'
import { formatCurrencyVND } from '../../../../utils/formatters'

export interface SlotItemPickerModalProps {
  isOpen: boolean
  onClose: () => void
  slot: OutfitSlotKey | null
  cartFashionItems: CartFashionItem[]
  availableProducts: Product[]
  selectedOutfit: OutfitSlots
  height: number
  weight: number
  gender?: 'male' | 'female'
  onGenderChange?: (gender: 'male' | 'female') => void
  onSelectItem: (item: Product, slot: OutfitSlotKey) => void
}

const ITEMS_PER_PAGE = 20

const SLOT_META: Record<OutfitSlotKey, { label: string; icon: string; desc: string }> = {
  top: { label: 'Áo Trong (Layer 1)', icon: '👔', desc: 'Chọn áo thun, sơ mi, polo hoặc áo giữ nhiệt làm lớp nền bên trong' },
  outer_top: { label: 'Áo Khoác Ngoài (Layer 2)', icon: '🧥', desc: 'Chọn áo khoác, blazer, cardigan hoặc bomber mặc phủ bên ngoài áo trong' },
  bottom: { label: 'Quần & Váy', icon: '👖', desc: 'Chọn quần jean, tây, jogger, short hoặc chân váy chuẩn phom dáng' },
  shoes: { label: 'Giày & Dép', icon: '👟', desc: 'Chọn giày sneaker, da, lười, cao gót hoặc sandal năng động' },
  accessory: { label: 'Phụ Kiện (Đeo Nhiều Món)', icon: '🧢', desc: 'Chọn đồng thời nhiều phụ kiện khác vùng: Mũ, Kính, Dây chuyền, Dây nịt, Túi xách...' },
}

export const SlotItemPickerModal: React.FC<SlotItemPickerModalProps> = ({
  isOpen,
  onClose,
  slot,
  cartFashionItems = [],
  availableProducts = [],
  selectedOutfit = { top: null, outer_top: null, bottom: null, shoes: null, accessory: null, accessories: [] },
  height = 175,
  weight = 68,
  gender = 'male',
  onGenderChange,
  onSelectItem,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filterMode, setFilterMode] = useState<'all' | 'cart' | 'ai_recommended'>('all')
  const [genderFilter, setGenderFilter] = useState<'male' | 'female' | 'all'>(gender || 'male')
  const [visibleCount, setVisibleCount] = useState<number>(ITEMS_PER_PAGE)

  // Reset pagination và filter khi mở modal hoặc đổi slot / đổi giới tính
  useEffect(() => {
    if (isOpen) {
      setVisibleCount(ITEMS_PER_PAGE)
      setSearchQuery('')
      setFilterMode('all')
      setGenderFilter(gender || 'male')
    }
  }, [isOpen, slot, gender])

  // Danh sách các món đồ đang được trang bị ở các slot khác để AI phân tích tính tương hợp
  const otherEquippedItems = useMemo(() => {
    if (!slot || !selectedOutfit) return []
    const allItems = flattenOutfitItems(selectedOutfit)
    const currentId = slot === 'accessory' ? null : selectedOutfit[slot]?.id
    return allItems
      .filter(p => p && p.id !== currentId)
      .map(p => ({ slot: detectItemSlot(p) || 'top', product: p }))
  }, [slot, selectedOutfit])

  // Thuật toán AI Stylist: Phân tích hành vi & chấm điểm tương hợp từng món đồ theo giới tính
  const analyzedProducts = useMemo(() => {
    if (!slot || !Array.isArray(availableProducts)) return []

    const targetDetectSlot = slot === 'outer_top' ? 'top' : slot

    // 1. Lọc sản phẩm thuộc đúng slot này VÀ phù hợp với giới tính đang chọn (Nam / Nữ / Unisex)
    const matchingProducts = availableProducts.filter(p => {
      if (!p || detectItemSlot(p) !== targetDetectSlot) return false
      return isProductMatchingGender(p, genderFilter)
    })

    // Tạo tập set ID các món có trong giỏ hàng để ưu tiên hàng đầu
    const cartProductIds = new Set(
      (Array.isArray(cartFashionItems) ? cartFashionItems : [])
        .filter(c => c && c.product && detectItemSlot(c.product) === targetDetectSlot && isProductMatchingGender(c.product, genderFilter))
        .map(c => c.product.id)
    )

    // Từ khóa của các món đồ đang mặc để tính phối đồ
    const equippedText = otherEquippedItems
      .map(it => (it.product?.name || '').toLowerCase())
      .join(' ')

    const hasSneaker = equippedText.includes('sneaker') || equippedText.includes('thể thao')
    const hasJean = equippedText.includes('jean') || equippedText.includes('bò')
    const hasJogger = equippedText.includes('jogger') || equippedText.includes('nỉ')
    const hasFormal = equippedText.includes('sơ mi') || equippedText.includes('tây') || equippedText.includes('blazer')

    return matchingProducts.map(item => {
      const nameLower = (item?.name || '').toLowerCase()
      const inCart = Boolean(item?.id && cartProductIds.has(item.id))

      // Chấm điểm AI dựa trên hành vi và sự tương hợp
      let score = 86
      let reason = ''

      if (inCart) {
        score += 8
        reason = '🛒 Có sẵn trong giỏ hàng của bạn'
      }

      if ((hasSneaker || hasJogger) && (nameLower.includes('thun') || nameLower.includes('hoodie') || nameLower.includes('bomber') || nameLower.includes('jean') || nameLower.includes('jogger'))) {
        score += 4
        reason = reason || '🎯 AI Đề xuất: Phối chuẩn Streetwear với Giày Sneaker / Đồ thể thao đang chọn'
      } else if (hasFormal && (nameLower.includes('sơ mi') || nameLower.includes('tây') || nameLower.includes('da') || nameLower.includes('polo'))) {
        score += 4
        reason = reason || '👔 AI Đề xuất: Phối thanh lịch đồng điệu trang phục công sở'
      } else if (hasJean && (nameLower.includes('thun') || nameLower.includes('khoác') || nameLower.includes('sneaker'))) {
        score += 3
        reason = reason || '✨ AI Phân tích: Gam màu & chất liệu ăn ý với quần Jean đang chọn'
      }

      // Đánh giá theo vóc dáng người dùng
      if (height >= 170 && (nameLower.includes('suông') || nameLower.includes('oversize') || nameLower.includes('dáng dài'))) {
        score += 2
        reason = reason || `📏 AI Phân tích: Form suông tôn vóc dáng ${height}cm`
      }

      if (slot === 'outer_top' && isOuterwearProduct(item)) {
        score += 10
        reason = reason || '🧥 Phù hợp làm Áo khoác lớp ngoài (Layer 2)'
      } else if (slot === 'top' && !isOuterwearProduct(item)) {
        score += 5
      }

      // Giới hạn điểm từ 88 - 99
      const finalScore = Math.min(99, Math.max(88, score))
      if (!reason) {
        reason = `💡 AI Stylist: Phom dáng hài hòa, hợp xu hướng giới trẻ`
      }

      return {
        product: item,
        inCart,
        aiScore: finalScore,
        aiReason: reason,
        isOuter: isOuterwearProduct(item),
      }
    }).sort((a, b) => {
      if (slot === 'outer_top') {
        if (a.isOuter && !b.isOuter) return -1
        if (!a.isOuter && b.isOuter) return 1
      }
      // Ưu tiên số 1: Hàng trong giỏ hàng luôn lên đầu
      if (a.inCart && !b.inCart) return -1
      if (!a.inCart && b.inCart) return 1
      // Ưu tiên số 2: Điểm số AI cao nhất
      return b.aiScore - a.aiScore
    })
  }, [availableProducts, cartFashionItems, slot, otherEquippedItems, height, weight, genderFilter])

  // Lọc theo tìm kiếm và bộ lọc nhanh
  const filteredList = useMemo(() => {
    let list = analyzedProducts

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(item => (item.product?.name || '').toLowerCase().includes(q))
    }

    if (filterMode === 'cart') {
      list = list.filter(item => item.inCart)
    } else if (filterMode === 'ai_recommended') {
      list = list.filter(item => item.aiScore >= 94)
    }

    return list
  }, [analyzedProducts, searchQuery, filterMode])

  // Lấy số lượng sản phẩm hiển thị hiện tại (20 cái mỗi lần, cho phép xem thêm)
  const paginatedItems = useMemo(() => {
    return filteredList.slice(0, visibleCount)
  }, [filteredList, visibleCount])

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + ITEMS_PER_PAGE)
  }

  // TẤT CẢ HOOKS ĐÃ ĐƯỢC GỌI VÔ ĐIỀU KIỆN Ở TRÊN. GIỜ MỚI CHECK ĐIỀU KIỆN HIỂN THỊ:
  if (!isOpen || !slot || !SLOT_META[slot]) {
    return null
  }

  const meta = SLOT_META[slot]
  const accessoriesEquipped = selectedOutfit?.accessories || []
  const currentlyEquippedInThisSlot = slot !== 'accessory' && selectedOutfit ? selectedOutfit[slot] : null

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white border border-slate-200 rounded-3xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden text-slate-800 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200 text-[#ee4d2d] flex items-center justify-center text-xl shrink-0">
                {meta.icon}
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    Chọn {meta.label} Phối Vào Bảng Đồ
                  </h3>
                  <span className="bg-orange-50 text-[#ee4d2d] border border-orange-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    {filteredList.length} Mẫu Khả Dụng
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {otherEquippedItems.length > 0 ? (
                    <>
                      Đang phối cùng:{' '}
                      <strong className="text-slate-800">
                        {otherEquippedItems.map(it => it.product?.name).filter(Boolean).join(' + ')}
                      </strong>
                    </>
                  ) : (
                    meta.desc
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold transition cursor-pointer"
              title="Đóng modal"
            >
              ✕
            </button>
          </div>

          {/* BANNER AI PHÂN TÍCH HÀNH VI & ĐỀ XUẤT THÔNG MINH */}
          <div className="bg-gradient-to-r from-orange-50/90 via-amber-50/80 to-orange-50/90 border border-orange-200/80 rounded-2xl p-3 sm:p-3.5 flex items-start gap-3 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-[#ee4d2d] text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-xs">
              🤖
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-[#ee4d2d]">AI Stylist Phân Tích Hành Vi & Gợi Ý:</span>
                <span className="text-[10px] font-semibold text-slate-600 bg-white/80 px-2 py-0.2 rounded-md border border-orange-200/60">
                  Chuẩn vóc dáng {height}cm • {weight}kg
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {otherEquippedItems.length > 0
                  ? `Dựa trên ${otherEquippedItems.map(it => it.product?.name).filter(Boolean).slice(0, 2).join(' và ')} bạn đang chọn, AI ưu tiên các sản phẩm trong giỏ hàng lên đầu và tự động chấm điểm độ hợp phom dáng cho từng mẫu ${meta.label.toLowerCase()}.`
                  : `Dựa vào vóc dáng và sở thích mua sắm của bạn, AI ưu tiên sản phẩm trong giỏ hàng và tuyển chọn các mẫu ${meta.label.toLowerCase()} có điểm thẩm mỹ cao nhất.`}
              </p>
            </div>
          </div>

          {/* DANH SÁCH PHỤ KIỆN ĐANG ĐEO CÙNG LÚC */}
          {slot === 'accessory' && accessoriesEquipped.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap bg-amber-50/70 border border-amber-200/80 rounded-xl px-3 py-2">
              <span className="text-[11px] font-bold text-amber-900 shrink-0">
                🧢 Đang đeo ({accessoriesEquipped.length}):
              </span>
              {accessoriesEquipped.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => onSelectItem(acc, 'accessory')}
                  className="inline-flex items-center gap-1.5 bg-white hover:bg-rose-50 border border-amber-300 hover:border-rose-300 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-800 transition cursor-pointer group"
                  title="Bấm để bỏ phụ kiện này"
                >
                  <img
                    src={acc.image || 'https://placehold.co/32x32'}
                    alt={acc.name}
                    className="w-4 h-4 rounded object-cover"
                  />
                  <span className="max-w-[120px] truncate">{acc.name}</span>
                  <span className="text-rose-500 font-bold text-[10px]">✕</span>
                </button>
              ))}
            </div>
          )}

          {/* THANH TÌM KIẾM & BỘ LỌC NHANH */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setVisibleCount(ITEMS_PER_PAGE)
                }}
                placeholder={`Tìm kiếm ${meta.label.toLowerCase()} theo tên, kiểu dáng...`}
                className="w-full pl-8 pr-8 py-2 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#ee4d2d] focus:outline-hidden transition"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold w-5 h-5 flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* BỘ LỌC GIỚI TÍNH & PHONG CÁCH */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {/* Lọc Giới Tính (Nam / Nữ / Tất Cả) */}
              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => {
                    setGenderFilter('male')
                    onGenderChange?.('male')
                    setVisibleCount(ITEMS_PER_PAGE)
                  }}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                    genderFilter === 'male'
                      ? 'bg-[#ee4d2d] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>👨</span> Đồ Nam
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGenderFilter('female')
                    onGenderChange?.('female')
                    setVisibleCount(ITEMS_PER_PAGE)
                  }}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                    genderFilter === 'female'
                      ? 'bg-[#ee4d2d] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>👩</span> Đồ Nữ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGenderFilter('all')
                    setVisibleCount(ITEMS_PER_PAGE)
                  }}
                  className={`px-2 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                    genderFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Tất Cả
                </button>
              </div>

              {/* Lọc Nguồn & AI */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('all')
                    setVisibleCount(ITEMS_PER_PAGE)
                  }}
                  className={`px-2.5 py-1.5 rounded-xl font-medium transition cursor-pointer whitespace-nowrap ${
                    filterMode === 'all'
                      ? 'bg-slate-900 text-white font-bold shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tất cả ({analyzedProducts.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('cart')
                    setVisibleCount(ITEMS_PER_PAGE)
                  }}
                  className={`px-2.5 py-1.5 rounded-xl font-medium transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    filterMode === 'cart'
                      ? 'bg-slate-900 text-white font-bold shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>🛒</span> Giỏ ({analyzedProducts.filter(i => i.inCart).length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('ai_recommended')
                    setVisibleCount(ITEMS_PER_PAGE)
                  }}
                  className={`px-2.5 py-1.5 rounded-xl font-medium transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    filterMode === 'ai_recommended'
                      ? 'bg-slate-900 text-white font-bold shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>⚡</span> AI Cao (≥94%)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL BODY (DANH SÁCH 20 SẢN PHẨM MỖI LẦN) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50">
          {filteredList.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
              <p>Không tìm thấy mẫu {meta.label.toLowerCase()} nào phù hợp với bộ lọc.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setFilterMode('all')
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#ee4d2d] text-white text-xs font-bold cursor-pointer"
              >
                Xem Tất Cả Mẫu
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-3.5">
              {paginatedItems.map(({ product: item, inCart, aiScore, aiReason }) => {
                const isEquipped =
                  slot === 'accessory'
                    ? accessoriesEquipped.some(a => a.id === item.id)
                    : currentlyEquippedInThisSlot?.id === item.id
                const itemZone = slot === 'accessory' ? detectAccessoryZone(item) : null
                const hasSameZoneEquipped =
                  slot === 'accessory' &&
                  itemZone &&
                  itemZone !== 'other' &&
                  !isEquipped &&
                  accessoriesEquipped.some(a => detectAccessoryZone(a) === itemZone)

                return (
                  <div
                    key={item.id}
                    className={`flex flex-col p-2.5 rounded-2xl bg-white border transition-all group duration-150 ${
                      isEquipped
                        ? 'border-2 border-[#ee4d2d] ring-2 ring-[#ee4d2d]/20 shadow-md bg-orange-50/10'
                        : inCart
                        ? 'border-orange-200/90 shadow-2xs hover:border-[#ee4d2d]/60 hover:shadow-xs'
                        : 'border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    {/* Khung ảnh sản phẩm to rõ nét */}
                    <div className="relative w-full h-36 sm:h-44 rounded-xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center p-2">
                      <img
                        src={item.image || 'https://placehold.co/200x200?text=Item'}
                        alt={item.name}
                        className="w-full h-full object-contain group-hover:scale-105 transition duration-200"
                      />

                      {/* Huy hiệu: Trong giỏ hàng */}
                      {inCart && (
                        <span className="absolute top-2 left-2 text-[10px] font-bold text-white bg-[#ee4d2d] px-2 py-0.5 rounded-md shadow-xs">
                          🛒 Trong Giỏ
                        </span>
                      )}

                      {/* Nhãn vùng phụ kiện (nếu là tab phụ kiện) */}
                      {slot === 'accessory' && itemZone && (
                        <span className="absolute bottom-2 left-2 text-[10px] font-bold bg-white/95 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                          {getAccessoryZoneLabel(itemZone)}
                        </span>
                      )}

                      {/* Điểm AI tương hợp */}
                      <span className={`absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-2xs border ${
                        aiScore >= 95
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-white/90 text-slate-700 border-slate-200'
                      }`}>
                        ⚡ {aiScore}%
                      </span>
                    </div>

                    {/* Thông tin sản phẩm & Gợi ý AI */}
                    <div className="mt-2 flex-1 flex flex-col justify-between space-y-1.5">
                      <div>
                        <p 
                          className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug group-hover:text-[#ee4d2d] transition min-h-[30px]"
                          title={item.name}
                        >
                          {item.name}
                        </p>
                        <p className="text-[10px] text-slate-400 italic line-clamp-1 mt-0.5" title={aiReason}>
                          {aiReason}
                        </p>
                      </div>

                      <div>
                        <span className="text-sm font-bold text-[#ee4d2d] block">
                          {formatCurrencyVND(item.price || item.flashPrice)}
                        </span>

                        <button
                          type="button"
                          onClick={() => onSelectItem(item, slot)}
                          className={`mt-2 w-full py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                            isEquipped
                              ? 'bg-emerald-600 hover:bg-rose-600 text-white shadow-2xs'
                              : hasSameZoneEquipped
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-[#ee4d2d] hover:bg-[#d93b1d] text-white shadow-2xs hover:shadow-xs'
                          }`}
                        >
                          {isEquipped
                            ? '✓ Đang Đeo (Bấm bỏ)'
                            : hasSameZoneEquipped
                            ? '🔄 Đổi Cùng Vùng'
                            : slot === 'accessory'
                            ? '+ Đeo Thêm Cùng Lúc'
                            : '+ Phối Món Này'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* NÚT XEM THÊM 20 SẢN PHẨM TIẾP THEO (TRÁNH QUÁ TẢI) */}
          {filteredList.length > visibleCount && (
            <div className="pt-3 pb-1 text-center">
              <button
                type="button"
                onClick={handleLoadMore}
                className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[#ee4d2d] font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 mx-auto active:scale-[0.99] shadow-2xs"
              >
                <span>⚡</span> Xem Thêm 20 Sản Phẩm Tiếp Theo (Còn {filteredList.length - visibleCount} mẫu nữa) ➔
              </button>
              <p className="text-[11px] text-slate-400 mt-2">
                Đang hiển thị {visibleCount} trên tổng số {filteredList.length} mẫu {meta.label.toLowerCase()}
              </p>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-slate-500">
            {slot === 'accessory' ? (
              <>
                💡 Đã chọn <strong className="text-[#ee4d2d]">{accessoriesEquipped.length} phụ kiện</strong>. Bạn có thể bấm chọn nhiều vùng (Mũ, Kính, Dây chuyền, Dây nịt...) cùng lúc rồi bấm Hoàn Tất.
              </>
            ) : (
              <>
                💡 Bấm <strong className="text-[#ee4d2d]">&quot;+ Phối Món Này&quot;</strong> để gắn vào ô {meta.label.toLowerCase()} và tự động cập nhật vào phòng thử đồ AI.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              slot === 'accessory'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {slot === 'accessory' ? `✓ Hoàn Tất (${accessoriesEquipped.length} PK)` : 'Đóng'}
          </button>
        </div>

      </div>
    </div>
  )
}
