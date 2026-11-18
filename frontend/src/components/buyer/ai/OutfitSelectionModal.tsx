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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-md shrink-0">
                ⚡
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                    CHỌN SET ĐỒ AI (AI STYLIST)
                  </h3>
                  <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                    100 Set Simulation
                  </span>
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                    Giảm 8% Combo Cả Set
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  🎯 Phối xoay quanh: <strong className="text-amber-300">{anchorItem?.name || 'Món đồ đã chọn'}</strong> • Chuẩn vóc dáng <strong className="text-slate-200">{height}cm • {weight}kg</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 transition cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                title="Tạo lại 100 set phối ngẫu nhiên mới từ kho ZeroMall"
              >
                <span className={isLoading ? 'animate-spin' : ''}>↻</span>
                <span className="hidden sm:inline">Làm mới 100 Set</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm font-black transition cursor-pointer shadow-xs"
                title="Đóng bảng chọn set"
              >
                ✕
              </button>
            </div>
          </div>

          {/* VIBE FILTER PILLS - Không có thanh phân trang ở đầu */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-bold text-slate-400 shrink-0">Phong cách:</span>
            {[
              { key: 'all', label: `Tất cả (${outfits.length || 100})` },
              { key: 'streetwear', label: '🔥 Streetwear' },
              { key: 'smart casual', label: '👔 Smart Casual' },
              { key: 'sporty', label: '⚡ Sporty' },
              { key: 'minimalist', label: '🌿 Minimalist' },
              { key: 'hàn quốc', label: '✨ Hàn Quốc' },
            ].map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => handleVibeChange(v.key)}
                className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition cursor-pointer text-xs ${
                  selectedVibe === v.key
                    ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* MODAL BODY (DANH SÁCH 5 SET CARDS ĐƯỢC ƯU TIÊN LÊN ĐẦU) */}
        <div ref={listContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full border-4 border-amber-400/30 border-t-amber-400 animate-spin"></div>
              <p className="text-sm font-bold text-slate-200">AI đang mô phỏng 100 bộ phối và chọn lọc 5 set đẹp nhất...</p>
              <p className="text-xs text-slate-400 max-w-sm">Phân tích phối màu, phom dáng và sự vừa vặn với vóc dáng {height}cm • {weight}kg</p>
            </div>
          ) : filteredOutfits.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400 bg-white/5 rounded-2xl border border-dashed border-white/10 space-y-2">
              <p>Không tìm thấy bộ phối phù hợp với phong cách đã chọn.</p>
              <button
                type="button"
                onClick={() => handleVibeChange('all')}
                className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 text-xs font-black cursor-pointer shadow-xs"
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
                    className={`rounded-2xl p-4 transition-all duration-200 border ${
                      isSelectedBundle
                        ? 'bg-indigo-950/80 border-emerald-400 ring-2 ring-emerald-400/40 shadow-xl'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 shadow-md'
                    }`}
                  >
                    {/* Card Header: Rank, Score, Title, Tag */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs ${
                          bundle.rank === 1
                            ? 'bg-amber-400 text-slate-950'
                            : bundle.rank === 2
                            ? 'bg-slate-200 text-slate-900'
                            : bundle.rank === 3
                            ? 'bg-amber-700 text-white'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
                        }`}>
                          {bundle.badge || `#${bundle.rank}`}
                        </span>
                        <h4 className="text-sm sm:text-base font-black text-white">{bundle.title}</h4>
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                          {bundle.tag}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-emerald-400 bg-emerald-950/70 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
                          ⚡ {bundle.score}/100 đ
                        </span>
                        {isSelectedBundle && (
                          <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/40 flex items-center gap-1 animate-pulse">
                            <span>✓</span> ĐÃ CHỌN SET NÀY
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stylist Note */}
                    <p className="text-xs text-slate-300 italic mb-3 bg-black/30 px-3 py-1.5 rounded-xl border border-white/5">
                      &quot;{bundle.stylist_note}&quot;
                    </p>

                    {/* 4 Items in Set */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                      {bundle.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-400/30 transition group relative"
                        >
                          <img
                            src={it.product.image || 'https://placehold.co/60x60'}
                            alt={it.product.name}
                            className="w-12 h-12 object-cover rounded-lg bg-white shrink-0 border border-white/10"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] font-black text-indigo-300 uppercase block truncate">
                              {it.role}
                            </span>
                            <p className="text-[11px] font-bold text-slate-200 truncate group-hover:text-indigo-200">
                              {it.product.name}
                            </p>
                            <span className="text-[10px] font-black text-rose-400 block mt-0.5">
                              {formatCurrencyVND(it.product.price)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onAnchorItem(it.product)
                            }}
                            title="Phối 100 set xoay quanh món này"
                            className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 w-5 h-5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center text-[9px] shadow transition cursor-pointer"
                          >
                            🎯
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Footer Card: Price + Action Buttons */}
                    <div className="pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-3">
                        <div>
                          <span className="text-[9px] text-slate-400 block">Giá gốc:</span>
                          <span className="text-xs text-slate-400 line-through">
                            {formatCurrencyVND(bundle.total_price)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-amber-400 block">Combo -8%:</span>
                          <span className="text-sm font-black text-rose-400">
                            {formatCurrencyVND(bundle.combo_price)}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                          Tiết kiệm {formatCurrencyVND(bundle.savings)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* BƯỚC 1: XEM TRƯỚC vs BƯỚC 2: THỬ ĐỒ */}
                        {isSelectedBundle ? (
                          <button
                            type="button"
                            onClick={() => onExecuteTryOn(bundle)}
                            disabled={isLoadingAi}
                            className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 transition flex items-center gap-1.5 shadow-lg cursor-pointer ring-2 ring-emerald-400/80 animate-pulse active:scale-95 disabled:opacity-50"
                          >
                            <span>✨</span> {isLoadingAi ? 'Đang Mặc Đồ...' : '2. BẤM VÀO ĐÂY ĐỂ THỬ ĐỒ (0 GEM)'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSelectBundlePreview(bundle)}
                            className="px-3.5 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95"
                          >
                            <span>👁️</span> 1. Chọn Set Này (Xem Trước)
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onAddToCart(bundle)}
                          className="px-3.5 py-2 rounded-xl text-xs font-black bg-[#ee4d2d] hover:bg-[#d93b1d] text-white transition flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95"
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
            <div className="pt-4 border-t border-slate-800 space-y-3">
              {/* Nút Xem Thêm 5 Set Tiếp Theo To Rõ Ràng ở chân danh sách */}
              {currentPage < totalPages - 1 && (
                <button
                  type="button"
                  onClick={handleNextPage}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 text-amber-300 hover:text-white font-black text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99] shadow-md"
                >
                  <span>⚡</span> Xem Thêm 5 Set Tiếp Theo (Còn {filteredOutfits.length - (currentPage + 1) * SETS_PER_PAGE} set nữa) ➔
                </button>
              )}

              {/* Thanh điều hướng Trước / Sau & Số thứ tự trang */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-2xl border border-white/5 text-xs">
                <span className="text-slate-400 font-bold text-xs">
                  Hiển thị Set #{filteredOutfits.length > 0 ? currentPage * SETS_PER_PAGE + 1 : 0} - #{Math.min((currentPage + 1) * SETS_PER_PAGE, filteredOutfits.length)} / {filteredOutfits.length} set (Trang {currentPage + 1}/{totalPages})
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage === 0}
                    onClick={handlePrevPage}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    ◀ 5 Set Trước
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages - 1}
                    onClick={handleNextPage}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed shadow-xs"
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
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                      currentPage === idx
                        ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                        : 'bg-white/10 text-slate-400 hover:text-white hover:bg-white/20'
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
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-slate-400">
            💡 <strong className="text-slate-300">Gợi ý:</strong> Chọn set ưng ý rồi bấm nút <span className="text-emerald-400 font-bold">&quot;BẤM VÀO ĐÂY ĐỂ THỬ ĐỒ&quot;</span> để AI ướm thử miễn phí lên người bạn!
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer shrink-0"
          >
            Đóng Bảng Chọn Set
          </button>
        </div>

      </div>
    </div>
  )
}
