import React, { useState, useMemo, useRef } from 'react'
import type { Product } from '../FlashSale'
import type { ScoredOutfitBundle } from './VirtualTryOnModal'
import { formatCurrencyVND } from '../../../utils/formatters'

export interface OutfitSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  anchorItem: Product | null
  height: number
  weight: number
  gender: 'male' | 'female'
  isLoading: boolean
  outfits: ScoredOutfitBundle[]
  selectedBundleId: string | null
  onRefresh: () => void
  onAnchorItem: (item: Product) => void
  onSelectBundlePreview: (bundle: ScoredOutfitBundle) => void
  onExecuteTryOn: (bundle: ScoredOutfitBundle) => void
  onAddToCart: (bundle: ScoredOutfitBundle) => void
  isLoadingAi?: boolean
}

const SETS_PER_PAGE = 5

export const OutfitSelectionModal: React.FC<OutfitSelectionModalProps> = ({
  isOpen,
  onClose,
  anchorItem,
  height,
  weight,
  isLoading,
  outfits,
  selectedBundleId,
  onRefresh,
  onAnchorItem,
  onSelectBundlePreview,
  onExecuteTryOn,
  onAddToCart,
  isLoadingAi = false,
}) => {
  const [selectedVibe, setSelectedVibe] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState<number>(0)
  const listContainerRef = useRef<HTMLDivElement | null>(null)

  // Lọc theo phong cách (Vibe)
  const filteredOutfits = useMemo(() => {
    if (selectedVibe === 'all') return outfits
    return outfits.filter(o => (o.tag || '').toLowerCase().includes(selectedVibe.toLowerCase()) || (o.vibe || '').toLowerCase().includes(selectedVibe.toLowerCase()))
  }, [outfits, selectedVibe])

  // Tính toán phân trang
  const totalPages = Math.max(1, Math.ceil(filteredOutfits.length / SETS_PER_PAGE))
  const current5Sets = useMemo(() => {
    return filteredOutfits.slice(
      currentPage * SETS_PER_PAGE,
      (currentPage + 1) * SETS_PER_PAGE
    )
  }, [filteredOutfits, currentPage])

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(p => p + 1)
      listContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(p => p - 1)
      listContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleJumpToPage = (pageIdx: number) => {
    setCurrentPage(pageIdx)
    listContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleVibeChange = (vibeKey: string) => {
    setSelectedVibe(vibeKey)
    setCurrentPage(0)
    listContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden text-slate-800 font-sans">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200/80 text-[#ee4d2d] flex items-center justify-center font-bold text-xl shadow-2xs shrink-0">
                ✨
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    Gợi Ý 100 Set Phối Đồ AI Stylist
                  </h3>
                  <span className="bg-orange-50 text-[#ee4d2d] border border-orange-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    Giảm 8% Combo Cả Set
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Phối xoay quanh: <strong className="text-slate-800">{anchorItem?.name || 'Món đồ đã chọn'}</strong> • Chuẩn vóc dáng <strong className="text-slate-700">{height}cm • {weight}kg</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                title="Tạo lại 100 set phối ngẫu nhiên mới từ kho ZeroMall"
              >
                <span className={isLoading ? 'animate-spin' : ''}>↻</span>
                <span className="hidden sm:inline">Làm mới 100 Set</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold transition cursor-pointer"
                title="Đóng bảng chọn set"
              >
                ✕
              </button>
            </div>
          </div>

          {/* VIBE FILTER PILLS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-medium text-slate-500 shrink-0">Phong cách:</span>
            {[
              { key: 'all', label: `Tất cả (${outfits.length || 100})` },
              { key: 'streetwear', label: 'Streetwear' },
              { key: 'smart casual', label: 'Smart Casual' },
              { key: 'sporty', label: 'Thể Thao' },
              { key: 'minimalist', label: 'Tối Giản' },
              { key: 'hàn quốc', label: 'Hàn Quốc' },
            ].map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => handleVibeChange(v.key)}
                className={`px-3 py-1 rounded-xl font-medium whitespace-nowrap transition cursor-pointer text-xs ${
                  selectedVibe === v.key
                    ? 'bg-[#ee4d2d] text-white font-bold shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* MODAL BODY (DANH SÁCH 5 SET CARDS) */}
        <div ref={listContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-10 h-10 rounded-full border-3 border-orange-200 border-t-[#ee4d2d] animate-spin"></div>
              <p className="text-sm font-bold text-slate-800">AI đang mô phỏng 100 bộ phối và chọn lọc 5 set đẹp nhất...</p>
              <p className="text-xs text-slate-400 max-w-sm">Phân tích phối màu, phom dáng và sự vừa vặn với vóc dáng {height}cm • {weight}kg</p>
            </div>
          ) : filteredOutfits.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500 bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
              <p>Không tìm thấy bộ phối phù hợp với phong cách đã chọn.</p>
              <button
                type="button"
                onClick={() => handleVibeChange('all')}
                className="px-3 py-1.5 rounded-xl bg-[#ee4d2d] text-white text-xs font-bold cursor-pointer"
              >
                Xem Tất Cả (100 Set)
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {current5Sets.map((bundle) => {
                const isSelectedBundle = selectedBundleId === bundle.id
                return (
                  <div
                    key={bundle.id}
                    className={`rounded-2xl p-4 transition-all duration-200 border bg-white ${
                      isSelectedBundle
                        ? 'border-2 border-[#ee4d2d] bg-orange-50/20 shadow-md ring-2 ring-[#ee4d2d]/20'
                        : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    {/* Card Header: Rank, Score, Title, Tag */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                          bundle.rank === 1
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : bundle.rank === 2
                            ? 'bg-slate-100 text-slate-800'
                            : bundle.rank === 3
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {bundle.badge || `#${bundle.rank}`}
                        </span>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900">{bundle.title}</h4>
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {bundle.tag}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                          ⚡ {bundle.score}/100 đ
                        </span>
                        {isSelectedBundle && (
                          <span className="text-[10px] font-bold text-[#ee4d2d] bg-orange-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <span>✓</span> ĐÃ CHỌN SET NÀY
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stylist Note */}
                    <p className="text-xs text-slate-600 italic mb-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                      &quot;{bundle.stylist_note}&quot;
                    </p>

                    {/* 4 Items in Set: Hiển thị dạng thẻ đứng với ảnh to rõ ràng, tên & giá nằm ngay dưới */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-3.5 mb-3.5">
                      {bundle.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col p-2.5 rounded-2xl bg-slate-50/80 border border-slate-200/90 hover:border-slate-300 hover:shadow-xs transition group relative"
                        >
                          {/* Khung ảnh to rõ nét */}
                          <div className="relative w-full h-36 sm:h-44 md:h-48 rounded-xl overflow-hidden bg-white border border-slate-200/80 flex items-center justify-center p-2">
                            <img
                              src={it.product.image || 'https://placehold.co/200x200?text=Item'}
                              alt={it.product.name}
                              className="w-full h-full object-contain group-hover:scale-105 transition duration-200"
                            />

                            {/* Tag vai trò món đồ */}
                            <span className="absolute top-2 left-2 text-[10px] font-bold text-slate-700 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-md shadow-2xs border border-slate-200/80 truncate max-w-[85%]">
                              {it.role}
                            </span>

                            {/* Nút phối 100 set quanh món này */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onAnchorItem(it.product)
                              }}
                              title="Phối 100 set xoay quanh món này"
                              className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 w-6 h-6 rounded-lg bg-white/95 hover:bg-orange-50 border border-slate-200 text-slate-700 hover:text-[#ee4d2d] flex items-center justify-center text-xs shadow-xs transition cursor-pointer"
                            >
                              🎯
                            </button>
                          </div>

                          {/* Tên sản phẩm & giá nằm ngay dưới ảnh */}
                          <div className="mt-2.5 flex-1 flex flex-col justify-between">
                            <p 
                              className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug group-hover:text-[#ee4d2d] transition min-h-[32px]"
                              title={it.product.name}
                            >
                              {it.product.name}
                            </p>
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-sm font-bold text-[#ee4d2d]">
                                {formatCurrencyVND(it.product.price)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Footer Card: Price + Action Buttons */}
                    <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-3">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Giá gốc:</span>
                          <span className="text-xs text-slate-400 line-through">
                            {formatCurrencyVND(bundle.total_price)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-[#ee4d2d] block">Combo -8%:</span>
                          <span className="text-sm font-bold text-[#ee4d2d]">
                            {formatCurrencyVND(bundle.combo_price)}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                          Tiết kiệm {formatCurrencyVND(bundle.savings)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isSelectedBundle ? (
                          <button
                            type="button"
                            onClick={() => onExecuteTryOn(bundle)}
                            disabled={isLoadingAi}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#ee4d2d] hover:bg-[#d93b1d] text-white transition flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 disabled:opacity-50"
                          >
                            <span>✨</span> {isLoadingAi ? 'Đang Mặc Đồ...' : '2. BẤM ĐỂ THỬ ĐỒ (0 GEM)'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSelectBundlePreview(bundle)}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <span>👁️</span> 1. Chọn Set Này (Xem Trước)
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onAddToCart(bundle)}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                        >
                          <span>🛒</span> Mua Cả Set
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* PHẦN XEM THÊM VÀ PHÂN TRANG Ở CUỐI CÙNG (THEO ĐÚNG YÊU CẦU NGƯỜI DÙNG) */}
          {!isLoading && filteredOutfits.length > 0 && (
            <div className="pt-4 border-t border-slate-200 space-y-3">
              {/* Nút Xem Thêm 5 Set Tiếp Theo */}
              {currentPage < totalPages - 1 && (
                <button
                  type="button"
                  onClick={handleNextPage}
                  className="w-full py-3 rounded-2xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[#ee4d2d] font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99] shadow-2xs"
                >
                  <span>⚡</span> Xem Thêm 5 Set Tiếp Theo (Còn {filteredOutfits.length - (currentPage + 1) * SETS_PER_PAGE} set nữa) ➔
                </button>
              )}

              {/* Thanh điều hướng Trước / Sau & Số thứ tự trang */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 text-xs">
                <span className="text-slate-500 font-medium text-xs">
                  Hiển thị Set #{filteredOutfits.length > 0 ? currentPage * SETS_PER_PAGE + 1 : 0} - #{Math.min((currentPage + 1) * SETS_PER_PAGE, filteredOutfits.length)} / {filteredOutfits.length} set (Trang {currentPage + 1}/{totalPages})
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage === 0}
                    onClick={handlePrevPage}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    ◀ 5 Set Trước
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages - 1}
                    onClick={handleNextPage}
                    className="px-3.5 py-1.5 rounded-xl bg-[#ee4d2d] hover:bg-[#d93b1d] text-white text-xs font-bold transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed shadow-2xs"
                  >
                    5 Set Tiếp Theo ▶
                  </button>
                </div>
              </div>

              {/* Quick Jump Page Pills */}
              <div className="flex items-center justify-center gap-1 overflow-x-auto py-1">
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleJumpToPage(idx)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold transition flex items-center justify-center cursor-pointer ${
                      currentPage === idx
                        ? 'bg-[#ee4d2d] text-white font-bold shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-slate-500">
            💡 Gợi ý: Chọn set ưng ý rồi bấm <strong className="text-[#ee4d2d]">&quot;BẤM ĐỂ THỬ ĐỒ&quot;</strong> để AI ướm thử miễn phí lên người bạn!
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer shrink-0"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  )
}
