import React from 'react'
import type { Product } from '../../FlashSale'
import type { CartFashionItem, OutfitSlots } from './types'
import { detectItemSlot, getSlotBadgeText } from './tryonUtils'
import { formatCurrencyVND } from '../../../../utils/formatters'

interface TryOnWardrobeTabProps {
  sourceTab: 'cart' | 'catalog'
  setSourceTab: (tab: 'cart' | 'catalog') => void
  cartFashionItems: CartFashionItem[]
  availablePants: Product[]
  selectedOutfit: OutfitSlots
  categoryFilter: 'all' | 'top' | 'bottom' | 'shoes' | 'accessory'
  setCategoryFilter: (filter: 'all' | 'top' | 'bottom' | 'shoes' | 'accessory') => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  searchResults: Product[]
  setSearchResults: (items: Product[]) => void
  isSearchingDb: boolean
  isLoadingPants: boolean
  isScanningGarment: boolean
  onSearchDatabase: (query: string) => void
  onEquipItem: (item: Product) => void
  onAnchorItemTo100Sets: (item: Product) => void
  onCustomGarmentUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  customGarmentInputRef: React.RefObject<HTMLInputElement | null>
}

export const TryOnWardrobeTab: React.FC<TryOnWardrobeTabProps> = ({
  sourceTab,
  setSourceTab,
  cartFashionItems,
  availablePants,
  selectedOutfit,
  categoryFilter,
  setCategoryFilter,
  searchQuery,
  setSearchQuery,
  searchResults,
  setSearchResults,
  isSearchingDb,
  isLoadingPants,
  isScanningGarment,
  onSearchDatabase,
  onEquipItem,
  onAnchorItemTo100Sets,
  onCustomGarmentUpload,
  customGarmentInputRef,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 text-white shadow-xl space-y-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-xs sm:text-sm text-white flex items-center gap-1.5">
            <span>🛍️</span> Chọn Món Để Phối Vào Bảng Đồ
          </h3>
          <p className="text-[11px] text-slate-400">
            Chọn món để gắn vào ô hoặc bấm <strong>🎯 Phối 100 set</strong> để AI tạo bộ phối đẹp xoay quanh món đó
          </p>
        </div>
        <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
          {sourceTab === 'cart'
            ? `${cartFashionItems.length} món trong giỏ`
            : searchQuery.trim()
            ? `${searchResults.filter(p => categoryFilter === 'all' || detectItemSlot(p) === categoryFilter).length} kết quả`
            : `${availablePants.filter(p => categoryFilter === 'all' || detectItemSlot(p) === categoryFilter).length} mẫu`}
        </span>
      </div>

      {/* BỘ CHUYỂN NGUỒN: TRONG GIỎ HÀNG vs GỢI Ý CSDL */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-800/80 rounded-xl border border-slate-700">
        <button
          type="button"
          onClick={() => setSourceTab('cart')}
          className={`py-1.5 px-2 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
            sourceTab === 'cart'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>🛒</span> Trong Giỏ Hàng
          {cartFashionItems.length > 0 && (
            <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-indigo-900 text-white">
              {cartFashionItems.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setSourceTab('catalog')}
          className={`py-1.5 px-2 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
            sourceTab === 'catalog'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>💡</span> Kho Hàng ZeroMall
        </button>
      </div>

      {/* Nút Tải Ảnh Món Đồ Bất Kỳ Của Bạn */}
      <div>
        <button
          type="button"
          onClick={() => customGarmentInputRef.current?.click()}
          disabled={isScanningGarment}
          className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <span>📸</span> {isScanningGarment ? 'AI Đang Quét...' : 'Tải Ảnh Đồ Của Bạn Để Thử & Phối 100 Set'}
        </button>
        <input
          ref={customGarmentInputRef}
          type="file"
          accept="image/*"
          onChange={onCustomGarmentUpload}
          className="hidden"
        />
      </div>

      {/* Danh mục lọc */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 text-[11px]">
        {[
          { key: 'all', label: 'Tất cả' },
          { key: 'top', label: '👔 Áo (Tops)' },
          { key: 'bottom', label: '👖 Quần & Váy' },
          { key: 'shoes', label: '👟 Giày & Dép' },
          { key: 'accessory', label: '🧢 Phụ kiện' }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setCategoryFilter(tab.key as any)}
            className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition cursor-pointer text-xs ${
              categoryFilter === tab.key
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ô Tìm Kiếm (khi ở Catalog) */}
      {sourceTab === 'catalog' && (
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchDatabase(e.target.value)}
            placeholder="🔍 Tìm bất kỳ món nào (áo, sơ mi, jean, sneaker...)"
            className="w-full pl-8 pr-8 py-2 text-xs font-bold text-white bg-slate-800 border border-slate-700 rounded-xl focus:bg-slate-750 focus:border-indigo-500 transition shadow-2xs"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setSearchResults([])
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold w-5 h-5 flex items-center justify-center cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Danh sách items */}
      {isSearchingDb ? (
        <div className="text-center py-8 text-xs text-slate-400 flex flex-col items-center gap-2">
          <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
          Đang tìm kiếm đồ thời trang trong database ZeroMall...
        </div>
      ) : isLoadingPants ? (
        <div className="text-center py-8 text-xs text-slate-400 flex flex-col items-center gap-2">
          <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
          Đang nạp gợi ý từ CSDL ZeroMall...
        </div>
      ) : (
        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {(sourceTab === 'cart' ? cartFashionItems.map(c => c.product) : (searchQuery.trim() ? searchResults : availablePants))
            .filter((p) => {
              const slot = detectItemSlot(p)
              if (!slot) return false
              if (categoryFilter === 'all') return true
              return slot === categoryFilter
            })
            .map((item) => {
              const isEquipped = Object.values(selectedOutfit).some(it => it?.id === item.id)
              return (
                <div
                  key={item.id}
                  className={`p-2.5 rounded-2xl border transition-all flex items-center gap-3 ${
                    isEquipped
                      ? 'border-indigo-500 bg-indigo-950/60 ring-1 ring-indigo-500/40'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-950/60'
                  }`}
                >
                  <img
                    src={item.image || 'https://placehold.co/80x100?text=Item'}
                    alt={item.name}
                    className="w-12 h-14 object-cover rounded-xl border border-white/10 shrink-0 bg-white"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${isEquipped ? 'text-indigo-200' : 'text-slate-200'}`}>
                      {item.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-black text-rose-400">
                        {formatCurrencyVND(item.price || item.flashPrice)}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                        {getSlotBadgeText(item)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onAnchorItemTo100Sets(item)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 transition flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                      title="Phối 100 set đẹp xoay quanh món này"
                    >
                      <span>🎯</span> Phối 100 Set
                    </button>
                    <button
                      type="button"
                      onClick={() => onEquipItem(item)}
                      className={`px-2 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                        isEquipped
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      {isEquipped ? '✓ Đang Phối' : '+ Phối'}
                    </button>
                  </div>
                </div>
              )
            })}

          {searchQuery.trim() && searchResults.length === 0 && (
            <div className="text-center py-6 px-3 bg-slate-800/50 rounded-xl border border-dashed border-slate-700 text-slate-400 text-xs">
              Không tìm thấy món đồ thời trang nào khớp với &quot;{searchQuery}&quot; trong kho.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
