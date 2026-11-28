import React from 'react'
import { OutfitSelectionModal } from './OutfitSelectionModal'
import {
  TryOnMirrorStudio,
  TryOnMixMatchBuilder,
  TryOnWardrobeTab,
  TryOnScannerTab,
  GemShieldBar,
  SlotItemPickerModal,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Toast thông báo nhẹ nhàng */}
      {logic.toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-60 bg-slate-900 text-white font-medium text-xs px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-2">
          <span className="text-emerald-400">✓</span> {logic.toastMsg}
        </div>
      )}

      {/* Modal Dialog Container Chuẩn Tone Sáng ZeroMall */}
      <div 
        className="bg-[#f8fafc] w-[98vw] max-w-[1560px] h-[96vh] max-h-[96vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 text-slate-800 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar Chuẩn Thương Hiệu ZeroMall */}
        <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-xl text-[#ee4d2d] shrink-0">
              ✨
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                  Phòng Thử Đồ Trực Tuyến ZeroMall
                </h2>
                <span className="bg-orange-50 text-[#ee4d2d] border border-orange-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  AI Fitting Room
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Ướm thử trang phục chân thực lên cơ thể bằng AI • Chuẩn vóc dáng & mô phỏng siêu thực Ultra HD
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold transition cursor-pointer"
            title="Đóng phòng thử đồ"
          >
            ✕
          </button>
        </div>

        {/* Banner Gợi Ý 100 Set Phối Đồ AI */}
        <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border-b border-orange-100 px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs shrink-0">
          <div className="flex items-center gap-2 text-slate-800">
            <span className="text-sm shrink-0">⚡</span>
            <p className="text-xs font-semibold">
              AI Stylist đã mô phỏng sẵn 100 bộ phối đẹp theo vóc dáng của bạn (Giảm 8% khi mua trọn Combo)!
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              logic.setIsOutfitModalOpen(true)
              if (logic.topScoredOutfits.length === 0) logic.fetchTopScoredOutfits()
            }}
            className="px-3.5 py-1.5 rounded-xl bg-[#ee4d2d] hover:bg-[#d93b1d] text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
          >
            <span>✨</span> Khám Phá 100 Set Phối Đồ ➔
          </button>
        </div>

        {/* Modal Body: 2 Columns */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#f8fafc]">
          {/* Thanh hiển thị chế độ AI Siêu Thực Ultra HD */}
          <GemShieldBar />

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
              predictedSizes={logic.predictedSizes}
              selectedItemSizes={logic.resolvedItemSizes}
              onSelectItemSize={logic.setItemSizeOverride}
              isSizeGuideOpen={logic.isSizeGuideOpen}
              onToggleSizeGuide={() => logic.setIsSizeGuideOpen((prev) => !prev)}
              onAddSingleItemToCart={logic.handleAddSingleItemToCart}
              onBuySingleItem={logic.handleBuySingleItem}
              totalOutfitPrice={logic.totalOutfitPrice}
              onAddWholeOutfitToCart={logic.handleAddWholeOutfitToCart}
              onBuyWholeOutfit={logic.handleBuyWholeOutfit}
              fileInputRef={logic.fileInputRef}
              onPhotoUpload={logic.handlePhotoUpload}
              onClearUserPhoto={logic.handleClearUserPhoto}
              onSelectPresetModel={logic.handleSelectPresetModel}
              height={logic.height}
              setHeight={logic.setHeight}
              weight={logic.weight}
              setWeight={logic.setWeight}
              gender={logic.gender}
              setGender={logic.setGender}
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
                onBuyWholeOutfit={logic.handleBuyWholeOutfit}
              />

              {/* Bộ chuyển tab Cột 2 (Gọn gàng chỉ 2 tab trực quan) */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => logic.setRightColTab('wardrobe')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    logic.rightColTab === 'wardrobe'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>🛍️</span> Chọn Món Trong Kho / Giỏ Hàng
                </button>

                <button
                  type="button"
                  onClick={() => logic.setRightColTab('scanner')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    logic.rightColTab === 'scanner'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>🔬</span> Bóc Tách Vải (AI Parser)
                </button>
              </div>

              {/* Tab 1: Tủ đồ & Giỏ hàng */}
              {logic.rightColTab !== 'scanner' && (
                <TryOnWardrobeTab
                  gender={logic.gender}
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

              {/* Tab 2: AI Scanner */}
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

      {/* Modal chuyên biệt: Chọn món theo từng ô (Áo / Quần / Giày / Phụ kiện) với AI phân tích hành vi */}
      <SlotItemPickerModal
        isOpen={logic.isSlotPickerOpen}
        onClose={() => logic.setIsSlotPickerOpen(false)}
        slot={logic.slotPickerTarget}
        cartFashionItems={logic.cartFashionItems}
        availableProducts={logic.availablePants}
        selectedOutfit={logic.selectedOutfit}
        height={logic.height}
        weight={logic.weight}
        gender={logic.gender}
        onGenderChange={logic.setGender}
        onSelectItem={(item, slot) => logic.handleSelectSlotItem(item, slot)}
      />
    </div>
  )
}
