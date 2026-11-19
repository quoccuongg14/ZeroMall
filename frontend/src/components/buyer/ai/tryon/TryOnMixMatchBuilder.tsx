import React from 'react'
import type { Product } from '../../FlashSale'
import type { OutfitSlots, ScoredOutfitBundle, TryonEngineMode } from './types'
import { formatCurrencyVND } from '../../../../utils/formatters'

interface TryOnMixMatchBuilderProps {
  selectedOutfit: OutfitSlots
  activeOutfitSlot: 'top' | 'bottom' | 'shoes' | 'accessory'
  onSelectSlot: (slot: 'top' | 'bottom' | 'shoes' | 'accessory') => void
  onRemoveSlot: (slot: 'top' | 'bottom' | 'shoes' | 'accessory', e: React.MouseEvent) => void
  onApplyPreset: (type: 'streetwear' | 'office' | 'sport') => void
  isLoadingAi: boolean
  tryonEngineMode: TryonEngineMode
  totalOutfitPrice: number
  outfitItems: Product[]
  onTryOnWholeOutfit: () => void
  onAddWholeOutfitToCart: () => void
  selectedOutfitBundleId: string | null
  topScoredOutfits: ScoredOutfitBundle[]
  height: number
  weight: number
  onOpen100SetsModal: () => void
}

export const TryOnMixMatchBuilder: React.FC<TryOnMixMatchBuilderProps> = ({
  selectedOutfit,
  activeOutfitSlot,
  onSelectSlot,
  onRemoveSlot,
  onApplyPreset,
  isLoadingAi,
  tryonEngineMode,
  totalOutfitPrice,
  outfitItems,
  onTryOnWholeOutfit,
  onAddWholeOutfitToCart,
  selectedOutfitBundleId,
  topScoredOutfits,
  height,
  weight,
  onOpen100SetsModal,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 text-slate-800 shadow-2xs space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ee4d2d]"></span>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Bảng Phối Đồ (Mix & Match)
          </h3>
        </div>
        <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
          {outfitItems.length}/4 Món Đã Chọn
        </span>
      </div>

      <p className="text-xs text-slate-500">
        Bấm vào từng ô để chọn áo, quần, giày hoặc nón. Sau đó bấm <strong>Ướm Thử</strong> để AI mặc đồ lên người bạn.
      </p>

      {/* 4 NGĂN PHỐI ĐỒ: Áo, Quần, Giày, Mũ */}
      <div className="grid grid-cols-4 gap-2.5">
        {/* Ô 1: ÁO */}
        <div
          onClick={() => onSelectSlot('top')}
          className={`relative p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col items-center text-center ${
            activeOutfitSlot === 'top'
              ? 'border-[#ee4d2d] bg-orange-50/30 ring-2 ring-[#ee4d2d]/20 shadow-2xs'
              : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase text-slate-500 mb-1">👔 Áo</span>
          {selectedOutfit.top ? (
            <div className="w-full space-y-1">
              <div className="relative w-12 h-12 mx-auto">
                <img
                  src={selectedOutfit.top.image || 'https://placehold.co/60x60'}
                  alt={selectedOutfit.top.name}
                  className="w-full h-full object-cover rounded-lg border border-slate-200 bg-white"
                />
                <button
                  type="button"
                  onClick={(e) => onRemoveSlot('top', e)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[9px] font-bold shadow-xs hover:bg-rose-600 cursor-pointer"
                  title="Gỡ áo"
                >
                  ✕
                </button>
              </div>
              <p className="text-[10px] font-semibold text-slate-800 truncate max-w-[70px]">{selectedOutfit.top.name}</p>
            </div>
          ) : (
            <div className="h-12 flex flex-col items-center justify-center text-slate-400 hover:text-slate-600">
              <span className="text-base">+</span>
              <span className="text-[10px] font-medium">Chọn Áo</span>
            </div>
          )}
        </div>

        {/* Ô 2: QUẦN / VÁY */}
        <div
          onClick={() => onSelectSlot('bottom')}
          className={`relative p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col items-center text-center ${
            activeOutfitSlot === 'bottom'
              ? 'border-[#ee4d2d] bg-orange-50/30 ring-2 ring-[#ee4d2d]/20 shadow-2xs'
              : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase text-slate-500 mb-1">👖 Quần / Váy</span>
          {selectedOutfit.bottom ? (
            <div className="w-full space-y-1">
              <div className="relative w-12 h-12 mx-auto">
                <img
                  src={selectedOutfit.bottom.image || 'https://placehold.co/60x60'}
                  alt={selectedOutfit.bottom.name}
                  className="w-full h-full object-cover rounded-lg border border-slate-200 bg-white"
                />
                <button
                  type="button"
                  onClick={(e) => onRemoveSlot('bottom', e)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[9px] font-bold shadow-xs hover:bg-rose-600 cursor-pointer"
                  title="Gỡ quần"
                >
                  ✕
                </button>
              </div>
              <p className="text-[10px] font-semibold text-slate-800 truncate max-w-[70px]">{selectedOutfit.bottom.name}</p>
            </div>
          ) : (
            <div className="h-12 flex flex-col items-center justify-center text-slate-400 hover:text-slate-600">
              <span className="text-base">+</span>
              <span className="text-[10px] font-medium">Chọn Quần</span>
            </div>
          )}
        </div>

        {/* Ô 3: GIÀY / DÉP */}
        <div
          onClick={() => onSelectSlot('shoes')}
          className={`relative p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col items-center text-center ${
            activeOutfitSlot === 'shoes'
              ? 'border-[#ee4d2d] bg-orange-50/30 ring-2 ring-[#ee4d2d]/20 shadow-2xs'
              : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase text-slate-500 mb-1">👟 Giày / Dép</span>
          {selectedOutfit.shoes ? (
            <div className="w-full space-y-1">
              <div className="relative w-12 h-12 mx-auto">
                <img
                  src={selectedOutfit.shoes.image || 'https://placehold.co/60x60'}
                  alt={selectedOutfit.shoes.name}
                  className="w-full h-full object-cover rounded-lg border border-slate-200 bg-white"
                />
                <button
                  type="button"
                  onClick={(e) => onRemoveSlot('shoes', e)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[9px] font-bold shadow-xs hover:bg-rose-600 cursor-pointer"
                  title="Gỡ giày"
                >
                  ✕
                </button>
              </div>
              <p className="text-[10px] font-semibold text-slate-800 truncate max-w-[70px]">{selectedOutfit.shoes.name}</p>
            </div>
          ) : (
            <div className="h-12 flex flex-col items-center justify-center text-slate-400 hover:text-slate-600">
              <span className="text-base">+</span>
              <span className="text-[10px] font-medium">Chọn Giày</span>
            </div>
          )}
        </div>

        {/* Ô 4: MŨ / PHỤ KIỆN */}
        <div
          onClick={() => onSelectSlot('accessory')}
          className={`relative p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col items-center text-center ${
            activeOutfitSlot === 'accessory'
              ? 'border-[#ee4d2d] bg-orange-50/30 ring-2 ring-[#ee4d2d]/20 shadow-2xs'
              : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase text-slate-500 mb-1">🧢 Phụ Kiện</span>
          {selectedOutfit.accessory ? (
            <div className="w-full space-y-1">
              <div className="relative w-12 h-12 mx-auto">
                <img
                  src={selectedOutfit.accessory.image || 'https://placehold.co/60x60'}
                  alt={selectedOutfit.accessory.name}
                  className="w-full h-full object-cover rounded-lg border border-slate-200 bg-white"
                />
                <button
                  type="button"
                  onClick={(e) => onRemoveSlot('accessory', e)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[9px] font-bold shadow-xs hover:bg-rose-600 cursor-pointer"
                  title="Gỡ phụ kiện"
                >
                  ✕
                </button>
              </div>
              <p className="text-[10px] font-semibold text-slate-800 truncate max-w-[70px]">{selectedOutfit.accessory.name}</p>
            </div>
          ) : (
            <div className="h-12 flex flex-col items-center justify-center text-slate-400 hover:text-slate-600">
              <span className="text-base">+</span>
              <span className="text-[10px] font-medium">Chọn Nón</span>
            </div>
          )}
        </div>
      </div>

      {/* Gợi ý phối set nhanh */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
        <span className="text-[11px] font-medium text-slate-500">Gợi ý nhanh:</span>
        <button
          type="button"
          onClick={() => onApplyPreset('streetwear')}
          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
        >
          Streetwear
        </button>
        <button
          type="button"
          onClick={() => onApplyPreset('office')}
          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
        >
          Công Sở
        </button>
        <button
          type="button"
          onClick={() => onApplyPreset('sport')}
          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
        >
          Thể Thao
        </button>
      </div>

      {/* Tổng tiền & Nút Thao Tác Chính */}
      {outfitItems.length > 0 && (
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] text-slate-400 block">Tổng {outfitItems.length} món:</span>
            <span className="text-sm font-bold text-[#ee4d2d]">{formatCurrencyVND(totalOutfitPrice)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTryOnWholeOutfit}
              disabled={isLoadingAi}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#ee4d2d] hover:bg-[#d93b1d] text-white transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs active:scale-[0.98]"
            >
              <span>✨</span> {isLoadingAi ? 'Đang Ướm...' : (tryonEngineMode === 'free' ? 'Ướm Thử Lên Người (0 Gem)' : 'Ướm Thử Mage HD')}
            </button>
            <button
              type="button"
              onClick={onAddWholeOutfitToCart}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer active:scale-[0.98]"
            >
              <span>🛒</span> Mua Cả Bộ
            </button>
          </div>
        </div>
      )}

      {/* Banner Gợi ý 100 Set Phối Đồ AI */}
      <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border border-orange-200/80 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900">100 Set Phối Đồ AI Stylist</span>
            <span className="text-[10px] font-bold bg-orange-100 text-[#ee4d2d] px-2 py-0.2 rounded-full">
              Giảm 8% Combo
            </span>
          </div>
          <p className="text-[11px] text-slate-600 mt-0.5">
            {selectedOutfitBundleId
              ? `Đang chọn: ${topScoredOutfits.find(o => o.id === selectedOutfitBundleId)?.title || 'Set AI'}`
              : `Mô phỏng 100 bộ phối từ kho ZeroMall theo vóc dáng (${height}cm • ${weight}kg).`}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpen100SetsModal}
          className="px-3.5 py-1.5 bg-[#ee4d2d] hover:bg-[#d93b1d] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 ml-auto sm:ml-0"
        >
          <span>✨</span> Xem 100 Set ➔
        </button>
      </div>
    </div>
  )
}
