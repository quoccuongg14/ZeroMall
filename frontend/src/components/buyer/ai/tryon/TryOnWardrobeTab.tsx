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
    <div className="bg-white border border-slate-200 rounded-2xl p-4 text-slate-800 shadow-2xs space-y-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
            <span>🛍️</span> Chọn Món Đồ Phối Vào Bảng Đồ
          </h3>
          <p className="text-[11px] text-slate-400">
            Chọn món đồ bạn muốn để AI ướm thử vào cơ thể
          </p>
        </div>
        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
          {sourceTab === 'cart'
            ? `${cartFashionItems.length} món trong giỏ`
            : searchQuery.trim()
            ? `${searchResults.filter(p => categoryFilter === 'all' || detectItemSlot(p) === categoryFilter).length} kết quả`
            : `${availablePants.filter(p => categoryFilter === 'all' || detectItemSlot(p) === categoryFilter).length} mẫu`}
        </span>
      </div>

      {/* BỘ CHUYỂN NGUỒN: TRONG GIỎ HÀNG vs GỢI Ý CSDL */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
        <button
          type="button"
          onClick={() => setSourceTab('cart')}
          className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            sourceTab === 'cart'
              ? 'bg-white text-slate-900 shadow-2xs font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>🛒</span> Trong Giỏ Hàng
          {cartFashionItems.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#ee4d2d] text-white">
              {cartFashionItems.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setSourceTab('catalog')}
          className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            sourceTab === 'catalog'
              ? 'bg-white text-slate-900 shadow-2xs font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>🛍️</span> Kho Hàng ZeroMall
        </button>
      </div>

      {/* Nút Tải Ảnh Món Đồ Riêng Của Bạn */}
      <div>
        <button
          type="button"
          onClick={() => customGarmentInputRef.current?.click()}
          disabled={isScanningGarment}
          className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-[#ee4d2d] text-slate-700 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <span>📷</span> {isScanningGarment ? 'AI đang quét trang phục...' : 'Tải ảnh món đồ riêng của bạn để thử'}
        </button>
        <input
          ref={customGarmentInputRef}
          type="file"
          accept="image/*"
          onChange={onCustomGarmentUpload}
          className="hidden"
        />
      </div>

      {/* Danh mục lọc (Pills) */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 text-xs">
        {[
          { key: 'all', label: 'Tất cả' },
          { key: 'top', label: '👔 Áo' },
          { key: 'bottom', label: '👖 Quần & Váy' },
          { key: 'shoes', label: '👟 Giày Dép' },
          { key: 'accessory', label: '🧢 Phụ Kiện' }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setCategoryFilter(tab.key as any)}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer text-xs ${
              categoryFilter === tab.key
                ? 'bg-[#ee4d2d] text-white font-bold shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ô Tìm Kiếm */}
      {sourceTab === 'catalog' && (
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchDatabase(e.target.value)}
            placeholder="Tìm áo, sơ mi, jean, sneaker..."
            className="w-full pl-8 pr-8 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-xl focus:border-[#ee4d2d] focus:outline-hidden transition"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setSearchResults([])
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold w-5 h-5 flex items-center justify-center cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Danh sách sản phẩm */}
      {isSearchingDb ? (
        <div className="text-center py-8 text-xs text-slate-400 flex flex-col items-center gap-2">
          <span className="w-5 h-5 border-2 border-orange-200 border-t-[#ee4d2d] rounded-full animate-spin"></span>
          Đang tìm kiếm sản phẩm...
        </div>
      ) : isLoadingPants ? (
        <div className="text-center py-8 text-xs text-slate-400 flex flex-col items-center gap-2">
          <span className="w-5 h-5 border-2 border-orange-200 border-t-[#ee4d2d] rounded-full animate-spin"></span>
          Đang tải danh sách gợi ý...
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
                  className={`p-2.5 rounded-xl border transition-all flex items-center gap-3 ${
                    isEquipped
                      ? 'border-[#ee4d2d] bg-orange-50/20 shadow-2xs'
                      : 'border-slate-200/80 hover:border-slate-300 bg-white'
                  }`}
                >
                  <img
                    src={item.image || 'https://placehold.co/80x100?text=Item'}
                    alt={item.name}
                    className="w-12 h-14 object-cover rounded-lg border border-slate-200 shrink-0 bg-white"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${isEquipped ? 'text-[#ee4d2d]' : 'text-slate-800'}`}>
                      {item.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold text-[#ee4d2d]">
                        {formatCurrencyVND(item.price || item.flashPrice)}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                        {getSlotBadgeText(item)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onAnchorItemTo100Sets(item)}
                      className="w-7 h-7 rounded-lg text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 transition flex items-center justify-center cursor-pointer"
                      title="Gợi ý 100 set xoay quanh món này"
                    >
                      🎯
                    </button>
                    <button
                      type="button"
                      onClick={() => onEquipItem(item)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        isEquipped
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-white border border-[#ee4d2d] text-[#ee4d2d] hover:bg-orange-50 font-bold active:scale-95'
                      }`}
                    >
                      {isEquipped ? '✓ Đã Phối' : '+ Phối'}
                    </button>
                  </div>
                </div>
              )
            })}

          {searchQuery.trim() && searchResults.length === 0 && (
            <div className="text-center py-6 px-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
              Không tìm thấy sản phẩm thời trang nào khớp với &quot;{searchQuery}&quot;.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
