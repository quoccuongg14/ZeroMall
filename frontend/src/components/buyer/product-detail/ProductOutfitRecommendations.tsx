import React, { useState, useEffect } from 'react'
import { TRYON_SERVICE_URL } from '../../../config/api.config'
import { formatCurrencyVND } from '../../../utils/formatters'
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

interface ProductOutfitRecommendationsProps {
  product: Product
  onAddToCart?: (product: Product, quantity: number, variant: string) => void
  onOpenTryOnModal?: (bundle?: ScoredOutfitBundle) => void
}

export const ProductOutfitRecommendations: React.FC<ProductOutfitRecommendationsProps> = ({
  product,
  onAddToCart,
  onOpenTryOnModal
}) => {
  const [outfits, setOutfits] = useState<ScoredOutfitBundle[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [toastMsg, setToastMsg] = useState<string>('')

  // Kiểm tra sản phẩm có phải thời trang
  const isFashion = Boolean(
    (product.category || '').toLowerCase().includes('thời trang') ||
    (product.category || '').toLowerCase().includes('giày dép') ||
    (product.category || '').toLowerCase().includes('túi ví') ||
    (product.category || '').toLowerCase().includes('phụ kiện') ||
    (product.category || '').toLowerCase().includes('đồng hồ') ||
    ['áo', 'quần', 'váy', 'đầm', 'jean', 'jogger', 'bomber', 'jacket', 'sơ mi', 'thun', 'hoodie', 'blazer', 'polo', 'yếm', 'short', 'giày', 'sneaker', 'dép', 'sandal', 'boot', 'túi', 'ví', 'nón', 'mũ', 'đồng hồ'].some((k) =>
      (product.name || '').toLowerCase().includes(k)
    )
  )

  useEffect(() => {
    if (!product || !isFashion) {
      setIsLoading(false)
      return
    }

    const fetchTopOutfits = async () => {
      setIsLoading(true)
      try {
        const height = Number(localStorage.getItem('zeromall_tryon_user_height')) || 175
        const weight = Number(localStorage.getItem('zeromall_tryon_user_weight')) || 68
        const gender = (localStorage.getItem('zeromall_tryon_user_gender') as 'male' | 'female') || 'male'

        const res = await fetch(`${TRYON_SERVICE_URL}/api/tryon/generate-top-outfits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product: {
              id: product.id,
              name: product.name,
              price: product.price || product.flashPrice,
              category: product.category,
              image: product.image
            },
            height_cm: height,
            weight_kg: weight,
            gender: gender
          })
        })

        if (res.ok) {
          const data = await res.json()
          if (data.success && Array.isArray(data.outfits)) {
            setOutfits(data.outfits)
          }
        }
      } catch (e) {
        console.warn('[ProductOutfitRecommendations] Failed to fetch top outfits:', e)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTopOutfits()
  }, [product?.id, isFashion])

  const handleAddBundleToCart = (bundle: ScoredOutfitBundle) => {
    if (!onAddToCart) {
      showToast('Chức năng thêm vào giỏ hàng chưa sẵn sàng!')
      return
    }
    let count = 0
    bundle.items.forEach((it) => {
      if (it.product) {
        onAddToCart(it.product, 1, 'Size Tiêu Chuẩn')
        count++
      }
    })
    showToast(`🎉 Đã thêm trọn bộ ${count} món (Tiết kiệm ${formatCurrencyVND(bundle.savings)}) vào giỏ hàng!`)
  }

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  if (!isFashion || (!isLoading && outfits.length === 0)) {
    return null
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border border-indigo-500/40 rounded-3xl p-5 sm:p-6 text-white shadow-xl my-6 relative overflow-hidden">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-60 bg-emerald-600 text-white font-black text-xs px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <span>✓</span> {toastMsg}
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
              <span>⚡</span> 100 Set Simulation Engine
            </span>
            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Bánh Xe Màu Sắc & Tỷ Lệ Nhân Trắc Học
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Ưu Đãi Combo Giảm 8%
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
            <span>✨ Gợi Ý Phối Cả Set Cho Sản Phẩm Này</span>
            <span className="text-xs font-normal text-slate-300">(Mô phỏng 100 set • Chọn lọc Top 5 set điểm cao nhất)</span>
          </h3>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            AI Stylist tự động quét toàn bộ kho thời trang thực tế của ZeroMall để phối ra 100 tổ hợp hoàn hảo nhất quanh món đồ bạn đang xem.
          </p>
        </div>

        {onOpenTryOnModal && (
          <button
            type="button"
            onClick={() => onOpenTryOnModal()}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-md active:scale-[0.98]"
          >
            <span>📸</span> Mở Buồng Thử Đồ AI ➔
          </button>
        )}
      </div>

      {/* Outfits List / Grid */}
      {isLoading ? (
        <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-3 border-indigo-500/30 border-t-indigo-400 animate-spin"></div>
          <p className="text-xs font-bold text-slate-200">AI đang mô phỏng 100 bộ phối đồ và chấm điểm thời trang...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {outfits.map((bundle) => {
            const isTop1 = bundle.rank === 1
            const isTop2 = bundle.rank === 2
            const isTop3 = bundle.rank === 3

            return (
              <div
                key={bundle.id}
                className={`rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 relative ${
                  isTop1
                    ? 'bg-gradient-to-b from-amber-950/40 via-slate-900/95 to-slate-900 border-2 border-amber-400/80 shadow-xl'
                    : isTop2
                    ? 'bg-slate-900/90 border border-slate-400/50 shadow-md'
                    : isTop3
                    ? 'bg-slate-900/90 border border-amber-700/50 shadow-md'
                    : 'bg-slate-900/90 border border-slate-800'
                }`}
              >
                {/* Rank & Score */}
                <div className="flex items-center justify-between gap-1 mb-2.5">
                  <span
                    className={`text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs ${
                      isTop1
                        ? 'bg-amber-400 text-slate-950'
                        : isTop2
                        ? 'bg-slate-200 text-slate-900'
                        : isTop3
                        ? 'bg-amber-700 text-white'
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
                    }`}
                  >
                    {bundle.badge}
                  </span>
                  <span className="text-[11px] font-black text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                    {bundle.score}/100 đ
                  </span>
                </div>

                {/* Title */}
                <div className="mb-2">
                  <h4 className="text-xs font-black text-white line-clamp-1">{bundle.title}</h4>
                  <span className="text-[10px] font-bold text-indigo-300 block mt-0.5">
                    {bundle.tag}
                  </span>
                </div>

                {/* Stylist Note */}
                <div className="mb-3 p-2 rounded-xl bg-black/40 border border-white/5 text-[10px] text-slate-300 italic leading-relaxed">
                  "{bundle.stylist_note}"
                </div>

                {/* Items preview */}
                <div className="space-y-1.5 mb-3 flex-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    Trọn bộ gồm {bundle.items.length} món:
                  </span>
                  {bundle.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-1.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition"
                    >
                      <img
                        src={it.product.image || 'https://placehold.co/50x50'}
                        alt={it.product.name}
                        className="w-9 h-9 object-cover rounded-lg bg-white shrink-0 border border-white/10"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] font-bold text-indigo-300 block truncate">
                          {it.role}
                        </span>
                        <p className="text-[10px] font-semibold text-slate-200 truncate">
                          {it.product.name}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-slate-300 shrink-0">
                        {formatCurrencyVND(it.product.price)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Price & Discount */}
                <div className="pt-2.5 pb-3 border-t border-white/10 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Giá gốc cả bộ:</span>
                    <span className="text-slate-400 line-through">
                      {formatCurrencyVND(bundle.total_price)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400">Combo Giảm 8%:</span>
                    <span className="text-sm font-black text-rose-400">
                      {formatCurrencyVND(bundle.combo_price)}
                    </span>
                  </div>
                  <div className="text-[10px] font-bold text-emerald-400 text-right">
                    Tiết kiệm {formatCurrencyVND(bundle.savings)}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-1.5 pt-1">
                  {onOpenTryOnModal && (
                    <button
                      type="button"
                      onClick={() => onOpenTryOnModal(bundle)}
                      className="w-full py-2 px-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-[0.98]"
                    >
                      <span>✨</span>
                      Ướm Thử Set Này
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAddBundleToCart(bundle)}
                    className="w-full py-2 px-2.5 rounded-xl text-xs font-black bg-[#ee4d2d] hover:bg-[#d93b1d] text-white transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-[0.98]"
                  >
                    <span>🛒</span>
                    Thêm Cả Set Vào Giỏ
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
