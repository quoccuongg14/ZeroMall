import React, { useState } from 'react'
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

interface ProductOutfitModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product
  outfits: ScoredOutfitBundle[]
  isLoading: boolean
  onAddToCart?: (product: Product, quantity: number, variant: string) => void
  onOpenTryOnModal?: (bundle?: ScoredOutfitBundle) => void
}

export const ProductOutfitModal: React.FC<ProductOutfitModalProps> = ({
  isOpen,
  onClose,
  product: _product,
  outfits,
  isLoading,
  onAddToCart,
  onOpenTryOnModal
}) => {
  const [toastMsg, setToastMsg] = useState<string>('')

  if (!isOpen) return null

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-60 bg-emerald-600 text-white font-black text-xs px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <span>✓</span> {toastMsg}
        </div>
      )}

      {/* Modal Dialog */}
      <div
        className="bg-slate-900 border border-indigo-500/40 rounded-3xl p-5 sm:p-6 text-white shadow-2xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-4 mb-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs flex items-center gap-1">
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
              <span className="text-xs font-normal text-slate-300">(Top 5 Set Điểm Cao Nhất)</span>
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              AI Stylist tự động quét toàn bộ kho thời trang thực tế của ZeroMall để mô phỏng 100 tổ hợp hoàn hảo nhất quanh món đồ bạn đang xem.
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {onOpenTryOnModal && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenTryOnModal()
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer flex items-center gap-1.5 shadow-md active:scale-[0.98]"
              >
                <span>📸</span> Mở Buồng Thử Đồ AI ➔
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer"
              title="Đóng cửa sổ"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Outfits List / Scrollable Body */}
        <div className="overflow-y-auto pr-1 flex-1">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-10 h-10 rounded-full border-3 border-indigo-500/30 border-t-indigo-400 animate-spin"></div>
              <p className="text-xs font-bold text-slate-200">AI đang mô phỏng 100 bộ phối đồ và chấm điểm thời trang...</p>
            </div>
          ) : outfits.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              Chưa tìm thấy gợi ý phối đồ phù hợp cho sản phẩm này.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 pb-2">
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
                          onClick={() => {
                            onClose()
                            onOpenTryOnModal(bundle)
                          }}
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
      </div>
    </div>
  )
}
