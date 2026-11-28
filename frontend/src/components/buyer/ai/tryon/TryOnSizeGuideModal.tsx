import React from 'react'
import type { Product } from '../../FlashSale'
import type { SizePredictionResult } from '../../../../utils/sizePredictor'
import { formatCurrencyVND } from '../../../../utils/formatters'

interface TryOnSizeGuideModalProps {
  isOpen: boolean
  onClose: () => void
  height: number
  weight: number
  gender: 'male' | 'female'
  outfitItems: Product[]
  predictedSizes: Record<string, SizePredictionResult>
  selectedItemSizes: Record<string, string>
  onSelectItemSize: (productId: string, size: string) => void
  onAddSingleItemToCart: (item: Product) => void
  onBuySingleItem: (item: Product) => void
  totalOutfitPrice: number
  onAddWholeOutfitToCart: () => void
  onBuyWholeOutfit: () => void
}

export const TryOnSizeGuideModal: React.FC<TryOnSizeGuideModalProps> = ({
  isOpen,
  onClose,
  height,
  weight,
  gender,
  outfitItems,
  predictedSizes,
  selectedItemSizes,
  onSelectItemSize,
  onAddSingleItemToCart,
  onBuySingleItem,
  totalOutfitPrice,
  onAddWholeOutfitToCart,
  onBuyWholeOutfit,
}) => {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden text-slate-800 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200/80 text-[#ee4d2d] flex items-center justify-center text-lg shrink-0">
              📏
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Gợi Ý Chọn Size Chuẩn ({outfitItems.length} Món)
                </h3>
                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                  {height || '--'}cm • {weight || '--'}kg • {gender === 'male' ? 'Nam' : 'Nữ'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                AI đề xuất size vừa vặn nhất theo vóc dáng bạn vừa ướm thử. Bạn có thể đổi size trước khi thêm giỏ hoặc mua ngay.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold transition cursor-pointer shrink-0"
            title="Đóng bảng gợi ý size"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-slate-50/70">
          {outfitItems.map((item) => {
            const pred = predictedSizes[item.id]
            const activeSize = selectedItemSizes[item.id] || pred?.recommendedSize || 'Freesize'
            const options = pred?.availableOptions || []
            const rawPrice = item.price || item.flashPrice || 0
            const numPrice = typeof rawPrice === 'number'
              ? rawPrice
              : (parseFloat(String(rawPrice).replace(/[^0-9]/g, '')) || 0)

            return (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3"
              >
                <div className="flex items-start gap-3">
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-16 h-16 rounded-xl object-contain bg-slate-50 border border-slate-200 shrink-0 p-1"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                      {item.name}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <span className="text-sm font-extrabold text-[#ee4d2d]">
                        {formatCurrencyVND(numPrice)}
                      </span>
                      {pred?.applicable ? (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          Gợi ý chuẩn: {pred.recommendedSize}
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                          {activeSize}
                        </span>
                      )}
                    </div>
                    {pred?.note && (
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        {pred.note}
                      </p>
                    )}
                  </div>

                  {options.length > 0 && (
                    <div className="shrink-0">
                      <span className="text-[10px] font-semibold text-slate-400 block mb-1 text-right">
                        Chọn size
                      </span>
                      <select
                        aria-label={`Chọn size cho ${item.name}`}
                        value={activeSize}
                        onChange={(e) => onSelectItemSize(item.id, e.target.value)}
                        className="text-xs font-bold text-[#ee4d2d] bg-orange-50/50 border border-orange-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-[#ee4d2d] cursor-pointer max-w-[130px]"
                      >
                        {options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => onAddSingleItemToCart(item)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-orange-50 hover:bg-orange-100 text-[#ee4d2d] border border-orange-200 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <span>🛒</span> Thêm Vào Giỏ
                  </button>
                  <button
                    type="button"
                    onClick={() => onBuySingleItem(item)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#ee4d2d] hover:bg-[#d93b1d] text-white transition cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    <span>⚡</span> Mua Ngay
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <span className="text-[11px] text-slate-400 block">Tổng {outfitItems.length} món theo size đã chọn:</span>
            <span className="text-base font-extrabold text-[#ee4d2d]">{formatCurrencyVND(totalOutfitPrice)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAddWholeOutfitToCart}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-orange-50 hover:bg-orange-100 text-[#ee4d2d] border border-orange-200 transition cursor-pointer"
            >
              🛒 Thêm Cả Bộ
            </button>
            <button
              type="button"
              onClick={onBuyWholeOutfit}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer shadow-xs"
            >
              ⚡ Mua Cả Bộ Ngay ➔
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
