import React from 'react'
import { OutfitSelectionModal } from './OutfitSelectionModal'
import {
  TryOnMirrorStudio,
  TryOnMixMatchBuilder,
  TryOnWardrobeTab,
  TryOnScannerTab,
  GemShieldBar,
  MageConfirmModal,
  useTryOnLogic,
} from './tryon'
import type { VirtualTryOnModalProps } from './tryon'

// Re-export types for backwards compatibility
export type { ScoredOutfitBundle, OutfitItem } from './tryon'

export const VirtualTryOnModal: React.FC<VirtualTryOnModalProps> = (props) => {
  const { isOpen, onClose, product } = props
  const logic = useTryOnLogic(props)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Toast */}
      {logic.toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-60 bg-emerald-600 text-white font-black text-xs px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-2">
          <span>✓</span> {logic.toastMsg}
        </div>
      )}

      {/* Modal xác nhận Mage Ultra HD */}
      <MageConfirmModal
        isOpen={logic.showMageConfirmModal}
        onClose={() => logic.setShowMageConfirmModal(false)}
        onConfirm={() => {
          logic.setTryonEngineMode('mage')
          logic.setShowMageConfirmModal(false)
          logic.triggerToast('💎 Đã bật chế độ Mage Ultra HD. Chỉ trừ Gem khi bạn bấm "Ướm Cả Bộ"!')
        }}
        gemBalance={logic.gemBalance}
      />

      {/* Modal Dialog */}
      <div 
        className="bg-slate-900 w-[99vw] max-w-[1680px] h-[97vh] max-h-[97vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-800 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="bg-slate-900 border-b border-slate-800 text-white px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-xl shrink-0">
              ✨
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Phòng Thử Đồ Online AI • Mảng Thời Trang
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  AI Neural Studio
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Gửi ảnh của bạn + Nhập chiều cao cân nặng + Chọn món đồ để AI ươm thử trang phục chân thực qua ảnh
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm font-black transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Banner Khám Phá 100 Set Phối Đồ AI */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-inner shrink-0">
          <div className="flex items-center gap-2 text-slate-950">
            <span className="text-base shrink-0">⚡</span>
            <p className="text-xs font-black">
              AI Stylist đã mô phỏng 100 bộ phối đồ đẹp nhất cho bạn (Hiển thị 5 Set/lần • Giảm 8% Combo Cả Set)!
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              logic.setIsOutfitModalOpen(true)
              if (logic.topScoredOutfits.length === 0) logic.fetchTopScoredOutfits()
            }}
            className="px-3.5 py-1.5 rounded-xl bg-slate-950 text-amber-300 hover:text-white font-black text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
          >
            <span>✨</span> Khám Phá 100 Set Phối Đồ Ngay ➔
          </button>
        </div>

        {/* Modal Body: 2 Columns */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-950/40">
          {/* Thanh bảo vệ Gem & Chế độ thử đồ */}
          <GemShieldBar
            tryonEngineMode={logic.tryonEngineMode}
            onSetEngineMode={(mode) => {
              logic.setTryonEngineMode(mode)
              logic.triggerToast(`Đã chuyển sang chế độ ${mode === 'free' ? 'Local AI (0 Gem - Miễn phí)' : 'Mage Ultra HD'}.`)
            }}
            onOpenMageConfirm={() => logic.setShowMageConfirmModal(true)}
            gemBalance={logic.gemBalance}
          />

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* CỘT 1: HERO FITTING MIRROR & HỒ SƠ THỂ HÌNH */}
            <TryOnMirrorStudio
              activeTab={logic.activeTab}
              setActiveTab={logic.setActiveTab}
              viewMode={logic.viewMode}
              setViewMode={logic.setViewMode}
              onOpen100SetsModal={() => {
                logic.setIsOutfitModalOpen(true)
                if (logic.topScoredOutfits.length === 0) logic.fetchTopScoredOutfits()
              }}
              isLoadingAi={logic.isLoadingAi}
              userPhoto={logic.userPhoto}
              userPhotoName={logic.userPhotoName}
              compositeTryOnImage={logic.compositeTryOnImage}
              tryonEngineMode={logic.tryonEngineMode}
              selectedPant={logic.selectedPant}
              extractedGarment={logic.extractedGarment}
              isScanningGarment={logic.isScanningGarment}
              onScanGarment={logic.handleScanGarment}
              fitResult={logic.fitResult}
              measurements={logic.measurements}
              outfitItems={logic.outfitItems}
              totalOutfitPrice={logic.totalOutfitPrice}
              onAddWholeOutfitToCart={logic.handleAddWholeOutfitToCart}
              fileInputRef={logic.fileInputRef}
              onPhotoUpload={logic.handlePhotoUpload}
              onClearUserPhoto={logic.handleClearUserPhoto}
              onSelectPresetModel={logic.handleSelectPresetModel}
              height={logic.height}
              setHeight={logic.setHeight}
              weight={logic.weight}
              setWeight={logic.setWeight}
              gender={logic.gender}
              physiqueInfo={logic.physiqueInfo}
              currentBmi={logic.currentBmi}
              onRunTryOn={() => {
                if (!logic.userPhoto) {
                  logic.triggerToast('⚠️ Vui lòng tải ảnh của bạn lên trước khi thử đồ!')
                  logic.fileInputRef.current?.click()
                  return
                }
                logic.handleRunTryOn(logic.selectedPant || product || undefined, logic.userPhoto, logic.height, logic.weight, logic.gender)
              }}
            />

            {/* CỘT 2: TRUNG TÂM PHỐI ĐỒ & TỦ ĐỒ */}
            <div className="xl:col-span-7 space-y-4 flex flex-col">
              {/* Bảng Mix & Match 4 món */}
              <TryOnMixMatchBuilder
                selectedOutfit={logic.selectedOutfit}
                activeOutfitSlot={logic.activeOutfitSlot}
                onSelectSlot={logic.handleSelectSlot}
                onRemoveSlot={logic.handleRemoveSlot}
                onApplyPreset={logic.handleApplyPreset}
                isLoadingAi={logic.isLoadingAi}
                tryonEngineMode={logic.tryonEngineMode}
                totalOutfitPrice={logic.totalOutfitPrice}
                outfitItems={logic.outfitItems}
                onTryOnWholeOutfit={() => {
                  if (!logic.userPhoto) {
                    logic.triggerToast('⚠️ Vui lòng tải ảnh của bạn lên trước khi thử đồ!')
                    logic.fileInputRef.current?.click()
                    return
                  }
                  logic.handleRunTryOn(undefined, undefined, undefined, undefined, undefined, logic.selectedOutfit)
                }}
                onAddWholeOutfitToCart={logic.handleAddWholeOutfitToCart}
                selectedOutfitBundleId={logic.selectedOutfitBundleId}
                topScoredOutfits={logic.topScoredOutfits}
                height={logic.height}
                weight={logic.weight}
                onOpen100SetsModal={() => {
                  logic.setIsOutfitModalOpen(true)
                  if (logic.topScoredOutfits.length === 0) logic.fetchTopScoredOutfits()
                }}
              />

              {/* Bộ chuyển tab Cột 2 */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => {
                    logic.setIsOutfitModalOpen(true)
                    if (logic.topScoredOutfits.length === 0) logic.fetchTopScoredOutfits()
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span>✨</span> Chọn 100 Set Đồ AI
                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-slate-950 text-amber-300">
                    Top 5 Đẹp Nhất
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => logic.setRightColTab('wardrobe')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                    logic.rightColTab === 'wardrobe'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>🛍️</span> Chọn Món Trong Kho / Giỏ
                </button>

                <button
                  type="button"
                  onClick={() => logic.setRightColTab('scanner')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                    logic.rightColTab === 'scanner'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>🔬</span> Quét & Bóc Tách (AI Scanner)
                </button>
              </div>

              {/* Tab 1: Launcher Card */}
              {logic.rightColTab === 'outfits100' && (
                <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 text-white shadow-2xl space-y-4 text-center">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center font-black text-2xl shadow-lg">
                    ⚡
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-black text-white">
                      KHO 100 SET PHỐI ĐỒ AI (AI STYLIST)
                    </h3>
                    <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                      AI đã mô phỏng 100 bộ phối từ kho ZeroMall xoay quanh <strong className="text-amber-300">{(logic.selectedPant || product || logic.outfitItems[0])?.name || 'món đồ của bạn'}</strong> và chọn lọc 5 set điểm cao nhất theo vóc dáng ({logic.height}cm • {logic.weight}kg).
                    </p>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        logic.setIsOutfitModalOpen(true)
                        if (logic.topScoredOutfits.length === 0) logic.fetchTopScoredOutfits()
                      }}
                      className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl transition flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <span>✨</span> Mở Bảng Chọn 100 Set Phối Đồ AI ➔
                    </button>
                    <button
                      type="button"
                      onClick={() => logic.setRightColTab('wardrobe')}
                      className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                    >
                      🛍️ Xem Kho Đồ / Giỏ Hàng
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 2: Tủ đồ & Giỏ hàng */}
              {logic.rightColTab === 'wardrobe' && (
                <TryOnWardrobeTab
                  sourceTab={logic.sourceTab}
                  setSourceTab={logic.setSourceTab}
                  cartFashionItems={logic.cartFashionItems}
                  availablePants={logic.availablePants}
                  selectedOutfit={logic.selectedOutfit}
                  categoryFilter={logic.categoryFilter}
                  setCategoryFilter={logic.setCategoryFilter}
                  searchQuery={logic.searchQuery}
                  setSearchQuery={logic.setSearchQuery}
                  searchResults={logic.searchResults}
                  setSearchResults={logic.setSearchResults}
                  isSearchingDb={logic.isSearchingDb}
                  isLoadingPants={logic.isLoadingPants}
                  isScanningGarment={logic.isScanningGarment}
                  onSearchDatabase={logic.handleSearchDatabase}
                  onEquipItem={logic.handleEquipItem}
                  onAnchorItemTo100Sets={logic.handleAnchorItemTo100Sets}
                  onCustomGarmentUpload={logic.handleCustomGarmentUpload}
                  customGarmentInputRef={logic.customGarmentInputRef}
                />
              )}

              {/* Tab 3: AI Scanner */}
              {logic.rightColTab === 'scanner' && (
                <TryOnScannerTab
                  selectedPant={logic.selectedPant}
                  extractedGarment={logic.extractedGarment}
                  isScanningGarment={logic.isScanningGarment}
                  onScanGarment={logic.handleScanGarment}
                  onAnchorItemTo100Sets={logic.handleAnchorItemTo100Sets}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal riêng biệt: Chọn 100 Set Phối Đồ AI */}
      <OutfitSelectionModal
        isOpen={logic.isOutfitModalOpen}
        onClose={() => logic.setIsOutfitModalOpen(false)}
        anchorItem={logic.selectedPant || product || logic.outfitItems[0] || null}
        height={logic.height}
        weight={logic.weight}
        gender={logic.gender}
        isLoading={logic.isLoadingTopOutfits}
        outfits={logic.topScoredOutfits}
        selectedBundleId={logic.selectedOutfitBundleId}
        onRefresh={() => logic.fetchTopScoredOutfits()}
        onAnchorItem={(item) => logic.handleAnchorItemTo100Sets(item)}
        onSelectBundlePreview={(bundle) => logic.handleSelectBundlePreview(bundle)}
        onExecuteTryOn={(bundle) => logic.handleExecuteTryOnBundle(bundle)}
        onAddToCart={(bundle) => logic.handleAddScoredOutfitToCart(bundle)}
        isLoadingAi={logic.isLoadingAi}
      />
    </div>
  )
}
