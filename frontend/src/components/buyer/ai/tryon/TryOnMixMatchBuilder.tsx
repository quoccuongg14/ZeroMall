import React from 'react'
import type { Product } from '../../FlashSale'
import type { OutfitSlots, OutfitSlotKey } from './types'
import { formatCurrencyVND } from '../../../../utils/formatters'
import { getProductColorVariants } from '../../../../utils/variantImageHelper'

interface InlineColorSwatchesProps {
  item: Product
  selectedColorVariants?: Record<string, string>
  onSelectItemColor?: (productId: string, colorName: string) => void
  compact?: boolean
}

const InlineColorSwatches: React.FC<InlineColorSwatchesProps> = ({
  item,
  selectedColorVariants = {},
  onSelectItemColor,
  compact = false,
}) => {
  const variants = getProductColorVariants(item)
  if (variants.length < 2 || !onSelectItemColor) return null
  const activeColor = selectedColorVariants[item.id] || (item as any).selectedVariant || variants[0]?.name || ''

  return (
    <div
      className="flex items-center justify-center gap-1 flex-wrap mt-1"
      onClick={(e) => e.stopPropagation()}
    >
      {variants.slice(0, 4).map((v) => {
        const isSel = v.name.toLowerCase() === activeColor.toLowerCase()
        return (
          <button
            key={v.name}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onSelectItemColor(item.id, v.name)
            }}
            title={`Đổi màu: ${v.name}`}
            className={`inline-flex items-center gap-0.5 rounded-md border transition cursor-pointer ${
              compact ? 'px-1 py-0.5 text-[8px]' : 'px-1.5 py-0.5 text-[9px]'
            } ${
              isSel
                ? 'border-[#ee4d2d] bg-orange-50 text-[#ee4d2d] font-bold shadow-2xs'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 font-medium'
            }`}
          >
            {v.image && (
              <img
                src={v.image}
                alt={v.name}
                className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} rounded-xs object-cover shrink-0`}
              />
            )}
            <span className="max-w-[38px] truncate">{v.name}</span>
          </button>
        )
      })}
    </div>
  )
}

interface TryOnMixMatchBuilderProps {
  selectedOutfit: OutfitSlots
  activeOutfitSlot: OutfitSlotKey
  onSelectSlot: (slot: OutfitSlotKey) => void
  onRemoveSlot: (slot: OutfitSlotKey, e: React.MouseEvent, itemId?: string) => void
  onApplyPreset: (type: 'streetwear' | 'office' | 'sport') => void
  isLoadingAi: boolean
  totalOutfitPrice: number
  outfitItems: Product[]
  selectedColorVariants?: Record<string, string>
  onSelectItemColor?: (productId: string, colorName: string) => void
  onTryOnWholeOutfit: () => void
  onBuyWholeOutfit: () => void
}

export const TryOnMixMatchBuilder: React.FC<TryOnMixMatchBuilderProps> = ({
  selectedOutfit,
  activeOutfitSlot,
  onSelectSlot,
  onRemoveSlot,
  onApplyPreset,
  isLoadingAi,
  totalOutfitPrice,
  outfitItems,
  selectedColorVariants = {},
  onSelectItemColor,
  onTryOnWholeOutfit,
  onBuyWholeOutfit,
}) => {
  const accessoriesList = selectedOutfit.accessories || (selectedOutfit.accessory ? [selectedOutfit.accessory] : [])

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 text-slate-800 shadow-2xs space-y-3.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ee4d2d]"></span>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Bảng Phối Đồ (Mix & Match)
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
            {outfitItems.length} Món Đã Chọn
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Hỗ trợ mặc <strong>2 lớp áo</strong> (Áo trong + Áo khoác ngoài) &amp; đeo <strong>nhiều phụ kiện</strong> (Mũ, Kính, Dây chuyền, Nịt...) cùng lúc.
      </p>

      {/* 4 NGĂN PHỐI ĐỒ: Áo (2 lớp), Quần, Giày, Phụ Kiện (Đa món) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Ô 1: ÁO (Lớp 1: Áo trong + Lớp 2: Áo khoác ngoài) */}
        <div
          className={`relative p-2.5 rounded-xl border transition-all flex flex-col justify-between text-center ${
            activeOutfitSlot === 'top' || activeOutfitSlot === 'outer_top'
              ? 'border-[#ee4d2d] bg-orange-50/30 ring-2 ring-[#ee4d2d]/20 shadow-2xs'
              : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
          }`}
        >
          <div
            onClick={() => onSelectSlot('top')}
            className="cursor-pointer flex flex-col items-center"
          >
            <span className="text-[10px] font-bold uppercase text-slate-500 mb-1">👔 Áo (Lớp 1)</span>
            {selectedOutfit.top ? (
              <div className="w-full space-y-1">
                <div className="relative w-11 h-11 mx-auto">
                  <img
                    src={selectedOutfit.top.image || 'https://placehold.co/60x60'}
                    alt={selectedOutfit.top.name}
                    className="w-full h-full object-cover rounded-lg border border-slate-200 bg-white"
                  />
                  <button
                    type="button"
                    onClick={(e) => onRemoveSlot('top', e)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[9px] font-bold shadow-xs hover:bg-rose-600 cursor-pointer"
                    title="Gỡ áo trong"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-[10px] font-semibold text-slate-800 truncate max-w-[90px] mx-auto">{selectedOutfit.top.name}</p>
                <InlineColorSwatches
                  item={selectedOutfit.top}
                  selectedColorVariants={selectedColorVariants}
                  onSelectItemColor={onSelectItemColor}
                />
              </div>
            ) : (
              <div className="h-11 flex flex-col items-center justify-center text-slate-400 hover:text-slate-600">
                <span className="text-base">+</span>
                <span className="text-[10px] font-medium">Chọn Áo Trong</span>
              </div>
            )}
          </div>

          {/* Ngăn Layer 2: Áo khoác ngoài */}
          <div className="mt-2 pt-1.5 border-t border-slate-200/80">
            {selectedOutfit.outer_top ? (
              <div className="space-y-1">
                <div
                  onClick={() => onSelectSlot('outer_top')}
                  className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-indigo-200 cursor-pointer hover:border-indigo-400 transition"
                  title={`Áo khoác ngoài: ${selectedOutfit.outer_top.name}`}
                >
                  <img
                    src={selectedOutfit.outer_top.image || 'https://placehold.co/40x40'}
                    alt={selectedOutfit.outer_top.name}
                    className="w-6 h-6 object-cover rounded shrink-0 border border-slate-100"
                  />
                  <span className="text-[9px] font-bold text-indigo-800 truncate flex-1 text-left">
                    🧥 {selectedOutfit.outer_top.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => onRemoveSlot('outer_top', e)}
                    className="w-3.5 h-3.5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[8px] font-bold shrink-0 hover:bg-rose-600 cursor-pointer"
                    title="Gỡ áo khoác"
                  >
                    ✕
                  </button>
                </div>
                <InlineColorSwatches
                  item={selectedOutfit.outer_top}
                  selectedColorVariants={selectedColorVariants}
                  onSelectItemColor={onSelectItemColor}
                  compact
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onSelectSlot('outer_top')}
                className="w-full py-1 px-1.5 rounded-lg bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70 text-[10px] font-bold transition cursor-pointer flex items-center justify-center gap-1"
                title="Mặc thêm áo khoác, blazer hoặc cardigan phủ ngoài áo trong"
              >
                <span>🧥</span>
                <span>+ Áo Khoác</span>
              </button>
            )}
          </div>
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
              <p className="text-[10px] font-semibold text-slate-800 truncate max-w-[70px] mx-auto">{selectedOutfit.bottom.name}</p>
              <InlineColorSwatches
                item={selectedOutfit.bottom}
                selectedColorVariants={selectedColorVariants}
                onSelectItemColor={onSelectItemColor}
              />
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
              <p className="text-[10px] font-semibold text-slate-800 truncate max-w-[70px] mx-auto">{selectedOutfit.shoes.name}</p>
              <InlineColorSwatches
                item={selectedOutfit.shoes}
                selectedColorVariants={selectedColorVariants}
                onSelectItemColor={onSelectItemColor}
              />
            </div>
          ) : (
            <div className="h-12 flex flex-col items-center justify-center text-slate-400 hover:text-slate-600">
              <span className="text-base">+</span>
              <span className="text-[10px] font-medium">Chọn Giày</span>
            </div>
          )}
        </div>

        {/* Ô 4: PHỤ KIỆN ĐA MÓN (Mũ, Kính, Dây chuyền, Dây nịt, Túi...) */}
        <div
          onClick={() => onSelectSlot('accessory')}
          className={`relative p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between text-center ${
            activeOutfitSlot === 'accessory'
              ? 'border-[#ee4d2d] bg-orange-50/30 ring-2 ring-[#ee4d2d]/20 shadow-2xs'
              : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase text-slate-500 mb-1">
            🧢 Phụ Kiện {accessoriesList.length > 0 ? `(${accessoriesList.length})` : ''}
          </span>

          {accessoriesList.length > 0 ? (
            <div className="w-full space-y-1.5 flex-1 flex flex-col justify-between">
              <div className="flex flex-wrap items-center justify-center gap-1.5 max-h-[76px] overflow-y-auto py-0.5">
                {accessoriesList.map((acc) => (
                  <div key={acc.id} className="relative w-9 h-9 shrink-0" title={acc.name}>
                    <img
                      src={acc.image || 'https://placehold.co/48x48'}
                      alt={acc.name}
                      className="w-full h-full object-cover rounded-lg border border-slate-200 bg-white"
                    />
                    <button
                      type="button"
                      onClick={(e) => onRemoveSlot('accessory', e, acc.id)}
                      className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[8px] font-bold shadow-xs hover:bg-rose-600 cursor-pointer"
                      title={`Gỡ ${acc.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectSlot('accessory')
                }}
                className="w-full py-1 px-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 text-[10px] font-bold transition cursor-pointer"
              >
                + Thêm phụ kiện
              </button>
            </div>
          ) : (
            <div className="h-14 flex flex-col items-center justify-center text-slate-400 hover:text-slate-600">
              <span className="text-base">+</span>
              <span className="text-[10px] font-medium">Chọn nhiều PK</span>
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
              <span>✨</span> {isLoadingAi ? 'Đang Ướm...' : 'Ướm Thử Lên Người'}
            </button>
            <button
              type="button"
              onClick={onBuyWholeOutfit}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer active:scale-[0.98]"
            >
              <span>🛒</span> Mua Cả Bộ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
