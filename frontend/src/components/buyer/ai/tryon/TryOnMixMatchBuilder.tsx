import React from 'react'
import type { Product } from '../../FlashSale'
import type { OutfitSlots, ScoredOutfitBundle, TryonEngineMode } from './types'

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
    <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-3.5 text-white shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5 uppercase tracking-wide">
            <span>🎨</span> Bảng Phối Đồ AI (Mix & Match)
          </h3>
        </div>
        <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
          {outfitItems.length}/4 Món Đã Phối
        </span>
      </div>

      <p className="text-[11px] text-slate-400">
        Bấm vào từng ô để chọn phối áo, quần, giày dép, mũ nón... AI sẽ tự động ướm trọn bộ lên cơ thể!
      </p>

      {/* 4 NGĂN PHỐI ĐỒ: Áo, Quần, Giày, Mũ */}
      <div className="grid grid-cols-4 gap-2">
        {/* Ô 1: ÁO */}
        <div
          onClick={() => onSelectSlot('top')}
          className={`relative p-2 rounded-xl border transition-all cursor-pointer flex flex-col items-center text-center ${
            activeOutfitSlot === 'top'
              ? 'border-indigo-400 bg-indigo-950/60 ring-2 ring-indigo-500/40 shadow-md'
              : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
          }`}
        >
          <span className="text-[10px] font-black uppercase text-indigo-300 mb-1">👔 Áo</span>
          {selectedOutfit.top ? (
            <div className="w-full space-y-1">
              <div className="relative w-12 h-12 mx-auto">
                <img
                  src={selectedOutfit.top.image || 'https://placehold.co/60x60'}
                  alt={selectedOutfit.top.name}
                  className="w-full h-full object-cover rounded-lg border border-white/20 bg-white"
                />
                <button
                  type="button"
                  onClick={(e) => onRemoveSlot('top', e)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] font-bold shadow hover:bg-rose-500 cursor-pointer"
                  title="Gỡ áo"
                >
                  ✕
                </button>
              </div>
              <p className="text-[9px] font-bold text-white truncate max-w-[70px]">{selectedOutfit.top.name}</p>
            </div>
          ) : (
            <div className="h-12 flex flex-col items-center justify-center text-slate-500 hover:text-indigo-300">
              <span className="text-sm">+</span>
              <span className="text-[9px] font-bold">Chọn Áo</span>
            </div>
          )}
        </div>

        {/* Ô 2: QUẦN / VÁY */}
        <div
          onClick={() => onSelectSlot('bottom')}
          className={`relative p-2 rounded-xl border transition-all cursor-pointer flex flex-col items-center text-center ${
            activeOutfitSlot === 'bottom'
              ? 'border-indigo-400 bg-indigo-950/60 ring-2 ring-indigo-500/40 shadow-md'
              : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
          }`}
        >
          <span className="text-[10px] font-black uppercase text-indigo-300 mb-1">👖 Quần/Váy</span>
          {selectedOutfit.bottom ? (
            <div className="w-full space-y-1">
              <div className="relative w-12 h-12 mx-auto">
                <img
                  src={selectedOutfit.bottom.image || 'https://placehold.co/60x60'}
                  alt={selectedOutfit.bottom.name}
                  className="w-full h-full object-cover rounded-lg border border-white/20 bg-white"
                />
                <button
                  type="button"
                  onClick={(e) => onRemoveSlot('bottom', e)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] font-bold shadow hover:bg-rose-500 cursor-pointer"
                  title="Gỡ quần"
                >
                  ✕
                </button>
              </div>
              <p className="text-[9px] font-bold text-white truncate max-w-[70px]">{selectedOutfit.bottom.name}</p>
            </div>
          ) : (
            <div className="h-12 flex flex-col items-center justify-center text-slate-500 hover:text-indigo-300">
              <span className="text-sm">+</span>
              <span className="text-[9px] font-bold">Chọn Quần</span>
            </div>
          )}
        </div>

        {/* Ô 3: GIÀY / DÉP */}
        <div
          onClick={() => onSelectSlot('shoes')}
          className={`relative p-2 rounded-xl border transition-all cursor-pointer flex flex-col items-center text-center ${
            activeOutfitSlot === 'shoes'
              ? 'border-indigo-400 bg-indigo-950/60 ring-2 ring-indigo-500/40 shadow-md'
              : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
          }`}
        >
          <span className="text-[10px] font-black uppercase text-indigo-300 mb-1">👟 Giày/Dép</span>
          {selectedOutfit.shoes ? (
            <div className="w-full space-y-1">
              <div className="relative w-12 h-12 mx-auto">
                <img
                  src={selectedOutfit.shoes.image || 'https://placehold.co/60x60'}
                  alt={selectedOutfit.shoes.name}
                  className="w-full h-full object-cover rounded-lg border border-white/20 bg-white"
                />
                <button
                  type="button"
                  onClick={(e) => onRemoveSlot('shoes', e)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] font-bold shadow hover:bg-rose-500 cursor-pointer"
                  title="Gỡ giày"
                >
                  ✕
                </button>
              </div>
              <p className="text-[9px] font-bold text-white truncate max-w-[70px]">{selectedOutfit.shoes.name}</p>
            </div>
          ) : (
            <div className="h-12 flex flex-col items-center justify-center text-slate-500 hover:text-indigo-300">
              <span className="text-sm">+</span>
              <span className="text-[9px] font-bold">Chọn Giày</span>
            </div>
          )}
        </div>

        {/* Ô 4: MŨ / PHỤ KIỆN */}
        <div
          onClick={() => onSelectSlot('accessory')}
          className={`relative p-2 rounded-xl border transition-all cursor-pointer flex flex-col items-center text-center ${
            activeOutfitSlot === 'accessory'
              ? 'border-indigo-400 bg-indigo-950/60 ring-2 ring-indigo-500/40 shadow-md'
              : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
          }`}
        >
          <span className="text-[10px] font-black uppercase text-indigo-300 mb-1">🧢 Mũ/Nón</span>
          {selectedOutfit.accessory ? (
            <div className="w-full space-y-1">
              <div className="relative w-12 h-12 mx-auto">
                <img
                  src={selectedOutfit.accessory.image || 'https://placehold.co/60x60'}
                  alt={selectedOutfit.accessory.name}
                  className="w-full h-full object-cover rounded-lg border border-white/20 bg-white"
                />
                <button
                  type="button"
                  onClick={(e) => onRemoveSlot('accessory', e)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] font-bold shadow hover:bg-rose-500 cursor-pointer"
                  title="Gỡ mũ"
                >
                  ✕
                </button>
              </div>
              <p className="text-[9px] font-bold text-white truncate max-w-[70px]">{selectedOutfit.accessory.name}</p>
            </div>
          ) : (
            <div className="h-12 flex flex-col items-center justify-center text-slate-500 hover:text-indigo-300">
              <span className="text-sm">+</span>
              <span className="text-[9px] font-bold">Chọn Mũ</span>
            </div>
          )}
        </div>
      </div>

      {/* Gợi ý phối set nhanh */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
        <span className="text-[10px] font-bold text-slate-400">Gợi ý phối sẵn:</span>
        <button
          type="button"
          onClick={() => onApplyPreset('streetwear')}
          className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition cursor-pointer"
        >
          🔥 Set Streetwear (Bomber+Jean+Sneaker)
        </button>
        <button
          type="button"
          onClick={() => onApplyPreset('office')}
          className="px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30 transition cursor-pointer"
        >
          👔 Set Công Sở (Sơ mi+Quần tây+Giày)
        </button>
        <button
          type="button"
          onClick={() => onApplyPreset('sport')}
          className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 transition cursor-pointer"
        >
          ⚡ Set Thể Thao (Thun+Jogger+Sneaker)
        </button>
      </div>

      {/* Total Outfit Price & Action Buttons */}
      {outfitItems.length > 0 && (
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 block">Tổng {outfitItems.length} món trong bộ:</span>
            <span className="text-sm font-black text-rose-400">{totalOutfitPrice.toLocaleString('vi-VN')}đ</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTryOnWholeOutfit}
              disabled={isLoadingAi}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md ${
                tryonEngineMode === 'free'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950'
              }`}
            >
              <span>✨</span> {isLoadingAi ? 'Đang Ướm...' : (tryonEngineMode === 'free' ? 'Ướm Cả Bộ (0 Gem)' : 'Ướm Cả Bộ (~350 Gem)')}
            </button>
            <button
              type="button"
              onClick={onAddWholeOutfitToCart}
              className="px-3 py-1.5 bg-[#ee4d2d] hover:bg-[#d93b1d] text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-md"
            >
              <span>🛒</span> Mua Cả Bộ
            </button>
          </div>
        </div>
      )}

      {/* Banner CTA: Mở Modal 100 Set Phối Đồ AI */}
      <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 border border-amber-500/30 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md mt-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center font-black text-lg shrink-0 shadow-sm">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-amber-300 uppercase">100 Set Phối Đồ AI (AI Stylist)</span>
              <span className="text-[10px] font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full">
                Top 5 Đẹp Nhất
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              {selectedOutfitBundleId
                ? `Đang chọn: ${topScoredOutfits.find(o => o.id === selectedOutfitBundleId)?.title || 'Set AI'} (Giảm 8% Combo)`
                : `Mô phỏng 100 bộ phối từ kho ZeroMall theo vóc dáng (${height}cm • ${weight}kg).`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpen100SetsModal}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 ml-auto sm:ml-0"
        >
          <span>✨</span> Chọn Set Đồ (100 Set) ➔
        </button>
      </div>
    </div>
  )
}
