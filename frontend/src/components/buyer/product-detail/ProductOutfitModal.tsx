import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatCurrencyVND } from '../../../utils/formatters'
import { addOutfitBundleToCart } from '../../../utils/cartBundleHelper'
import { loadSavedBodyProfile, predictProductSize } from '../../../utils/sizePredictor'
import type { Product } from '../FlashSale'

export interface OutfitItem {
  role: string
  slot?: 'top' | 'bottom' | 'shoes' | 'accessory'
  product: Product
}

export interface ScoredOutfitBundle {
  id: string
  rank: number
  badge: string
  score: number
  title: string
  tag: string
  vibe: string
  stylist_note: string
  items: OutfitItem[]
  total_price: number
  combo_price: number
  savings: number
  discount_percent: number
}

interface ProductOutfitModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product
  outfits: ScoredOutfitBundle[]
  isLoading: boolean
  onAddToCart?: (product: Product, quantity: number, variant: string) => void
  onOpenTryOnModal?: (bundle?: ScoredOutfitBundle) => void
}

function getRankBadgeClass(rank: number): string {
  if (rank === 1) return 'bg-amber-100 text-amber-800 border border-amber-200'
  if (rank === 2) return 'bg-slate-100 text-slate-800 border border-slate-200'
  if (rank === 3) return 'bg-orange-50 text-orange-800 border border-orange-200'
  return 'bg-slate-100 text-slate-600 border border-slate-200'
}

export const ProductOutfitModal: React.FC<ProductOutfitModalProps> = ({
  isOpen,
  onClose,
  product,
  outfits,
  isLoading,
  onAddToCart,
  onOpenTryOnModal,
}) => {
  const navigate = useNavigate()
  const [toastMsg, setToastMsg] = useState<string>('')
  const [visibleCount, setVisibleCount] = useState<number>(5)

  if (!isOpen) return null

  const bodyProfile = loadSavedBodyProfile()

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3500)
  }

  const buildBundlePerItemVariants = (bundle: ScoredOutfitBundle): Record<string, string> => {
    const perItemVariants: Record<string, string> = {}
    bundle.items.forEach((it) => {
      if (!it.product) return
      const isOuter = (it.slot as string) === 'outer_top' || /khoác|blazer|jacket/i.test(it.role || '')
      const pred = predictProductSize({
        product: it.product,
        heightCm: bodyProfile.heightCm,
        weightKg: bodyProfile.weightKg,
        gender: bodyProfile.gender,
        isOuterLayer: isOuter,
      })
      if (pred.recommendedSize) {
        perItemVariants[it.product.id] = pred.recommendedSize
      }
    })
    return perItemVariants
  }

  const handleAddBundleToCart = (bundle: ScoredOutfitBundle, goToCheckout = false) => {
    if (!onAddToCart) {
      showToast('Chức năng thêm vào giỏ hàng chưa sẵn sàng!')
      return
    }
    const items = bundle.items.map((it) => it.product).filter(Boolean)
    const perItemVariants = buildBundlePerItemVariants(bundle)
    const { addedCount, skippedCount } = addOutfitBundleToCart(
      items,
      'Freesize',
      onAddToCart,
      perItemVariants
    )

    if (addedCount === 0) {
      showToast('⚠️ Các sản phẩm trong set này hiện đã hết hàng!')
      return
    }

    if (goToCheckout) {
      try {
        localStorage.setItem('zm_checkout_step', 'checkout')
      } catch (_) {}
      onClose()
      navigate('/checkout')
      return
    }

    if (skippedCount > 0) {
      showToast(`🎉 Đã thêm ${addedCount} món vào giỏ (${skippedCount} món hết hàng). Đã chọn sẵn trong giỏ hàng!`)
    } else {
      showToast(`🎉 Đã thêm trọn bộ ${addedCount} món (Tiết kiệm ${formatCurrencyVND(bundle.savings)}) vào giỏ hàng!`)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-60 bg-slate-900 text-white font-semibold text-xs px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <span className="text-emerald-400">✓</span> {toastMsg}
        </div>
      )}

      <div
        className="bg-white border border-slate-200 rounded-3xl text-slate-800 shadow-2xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden relative font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span className="text-[#ee4d2d]">✨</span>
                Gợi Ý Phối Cả Set Cho Sản Phẩm Này
              </h3>
              <span className="bg-orange-50 text-[#ee4d2d] border border-orange-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                Ưu Đãi Combo Giảm 8%
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 truncate max-w-2xl">
              Phối chuẩn quanh: <strong className="text-slate-700">{product.name}</strong> • Gợi ý theo vóc dáng{' '}
              <strong className="text-slate-700">
                {bodyProfile.heightCm}cm • {bodyProfile.weightKg}kg
              </strong>
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {onOpenTryOnModal && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenTryOnModal(outfits[0])
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#ee4d2d] hover:bg-[#d93b1d] text-white transition cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-[0.98]"
              >
                <span>📸</span> Mở Buồng Thử Đồ AI ➔
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold transition cursor-pointer"
              title="Đóng cửa sổ"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body: Horizontal Set Cards */}
        <div className="overflow-y-auto p-4 sm:p-5 flex-1 bg-slate-50/70">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-10 h-10 rounded-full border-3 border-orange-200 border-t-[#ee4d2d] animate-spin"></div>
              <p className="text-xs font-bold text-slate-700">Đang chọn lọc những bộ phối phù hợp nhất...</p>
            </div>
          ) : outfits.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs bg-white rounded-2xl border border-dashed border-slate-200">
              Chưa tìm thấy gợi ý phối đồ phù hợp cho sản phẩm này.
            </div>
          ) : (
            <div className="space-y-4">
              {outfits.slice(0, visibleCount).map((bundle) => {
                const isTop1 = bundle.rank === 1
                const itemCount = bundle.items.length
                const gridColsClass =
                  itemCount <= 3
                    ? 'grid-cols-2 sm:grid-cols-3'
                    : itemCount === 5
                    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
                    : 'grid-cols-2 sm:grid-cols-4'

                return (
                  <div
                    key={bundle.id}
                    className={`rounded-2xl p-4 sm:p-5 bg-white transition-all duration-200 ${
                      isTop1
                        ? 'border-2 border-[#ee4d2d]/70 shadow-md ring-2 ring-orange-100/70'
                        : 'border border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    {/* Header Set */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${getRankBadgeClass(
                            bundle.rank
                          )}`}
                        >
                          {bundle.badge}
                        </span>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900">
                          {bundle.title}
                        </h4>
                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {bundle.tag}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 shrink-0">
                        ⚡ {bundle.score}/100 đ
                      </span>
                    </div>

                    {/* Stylist Note */}
                    <p className="text-xs text-slate-600 italic mb-3.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                      &quot;{bundle.stylist_note}&quot;
                    </p>

                    {/* Sản phẩm xếp theo hàng ngang với ảnh lớn */}
                    <div className={`grid ${gridColsClass} gap-3 sm:gap-3.5 mb-4`}>
                      {bundle.items.map((it, idx) => {
                        const isOuter = (it.slot as string) === 'outer_top' || /khoác|blazer|jacket/i.test(it.role || '')
                        const pred = it.product
                          ? predictProductSize({
                              product: it.product,
                              heightCm: bodyProfile.heightCm,
                              weightKg: bodyProfile.weightKg,
                              gender: bodyProfile.gender,
                              isOuterLayer: isOuter,
                            })
                          : null

                        return (
                          <div
                            key={`${it.product?.id || idx}-${idx}`}
                            className="flex flex-col p-2.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 hover:border-[#ee4d2d]/50 hover:shadow-xs transition group"
                          >
                            {/* Ảnh sản phẩm lớn */}
                            <div className="relative w-full h-40 sm:h-48 rounded-xl overflow-hidden bg-white border border-slate-200/80 flex items-center justify-center p-2">
                              <img
                                src={it.product.image || 'https://placehold.co/300x300?text=Item'}
                                alt={it.product.name}
                                className="w-full h-full object-contain group-hover:scale-105 transition duration-200"
                              />
                              <span className="absolute top-2 left-2 text-[10px] font-bold text-slate-700 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-md shadow-2xs border border-slate-200/80 truncate max-w-[85%]">
                                {it.role}
                              </span>
                            </div>

                            {/* Tên sản phẩm, size gợi ý & giá */}
                            <div className="mt-2.5 flex-1 flex flex-col justify-between gap-1.5">
                              <p
                                className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug group-hover:text-[#ee4d2d] transition min-h-[34px]"
                                title={it.product.name}
                              >
                                {it.product.name}
                              </p>
                              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                <span className="text-sm font-bold text-[#ee4d2d]">
                                  {formatCurrencyVND(it.product.price)}
                                </span>
                                {pred?.recommendedSize && (
                                  <span className="text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md">
                                    {pred.applicable ? `Size ${pred.recommendedSize}` : pred.recommendedSize}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Footer Set: Tổng tiền + Nút hành động ngang */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Giá gốc ({itemCount} món):</span>
                          <span className="text-xs text-slate-400 line-through">
                            {formatCurrencyVND(bundle.total_price)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-[#ee4d2d] block">Combo Giảm 8%:</span>
                          <span className="text-base font-extrabold text-[#ee4d2d]">
                            {formatCurrencyVND(bundle.combo_price)}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                          Tiết kiệm {formatCurrencyVND(bundle.savings)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap ml-auto">
                        {onOpenTryOnModal && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose()
                              onOpenTryOnModal(bundle)
                            }}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.98]"
                          >
                            <span>✨</span> Ướm Thử Set Này
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleAddBundleToCart(bundle, false)}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-orange-50 hover:bg-orange-100 text-[#ee4d2d] border border-orange-200 transition flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
                        >
                          <span>🛒</span> Thêm Cả Set
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddBundleToCart(bundle, true)}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-[#ee4d2d] hover:bg-[#d93b1d] text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.98]"
                        >
                          <span>⚡</span> Mua Cả Bộ Ngay ➔
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Progressive Load Button: Xem Thêm 5 Set Tiếp Theo */}
              {visibleCount < outfits.length && (
                <div className="pt-2 pb-1 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => Math.min(prev + 5, outfits.length))}
                    className="px-6 py-2.5 rounded-2xl bg-white hover:bg-orange-50 border border-orange-200 text-[#ee4d2d] font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 mx-auto active:scale-95 shadow-2xs"
                  >
                    <span>⚡</span> Xem Thêm 5 Set Tiếp Theo (Đang hiện {visibleCount}/{outfits.length} Set) ➔
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
