import React from 'react'
import type { Product } from '../../FlashSale'
import type { BodyMeasurements, ExtractedGarment, FitResult, TryonEngineMode } from './types'

interface TryOnMirrorStudioProps {
  activeTab: 'photo' | 'scanner' | 'heatmap'
  setActiveTab: (tab: 'photo' | 'scanner' | 'heatmap') => void
  viewMode: 'tryon' | 'original' | 'sidebyside'
  setViewMode: (mode: 'tryon' | 'original' | 'sidebyside') => void
  onOpen100SetsModal: () => void
  isLoadingAi: boolean
  userPhoto: string
  userPhotoName: string
  compositeTryOnImage: string
  tryonEngineMode: TryonEngineMode
  selectedPant: Product | null
  extractedGarment: ExtractedGarment | null
  isScanningGarment: boolean
  onScanGarment: () => void
  fitResult: FitResult | null
  measurements: BodyMeasurements | null
  outfitItems: Product[]
  totalOutfitPrice: number
  onAddWholeOutfitToCart: () => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClearUserPhoto: () => void
  onSelectPresetModel: (url: string, name: string, g: 'male' | 'female') => void
  height: number
  setHeight: (h: number) => void
  weight: number
  setWeight: (w: number) => void
  gender: 'male' | 'female'
  physiqueInfo: { badge: string }
  currentBmi: number
  onRunTryOn: () => void
}

export const TryOnMirrorStudio: React.FC<TryOnMirrorStudioProps> = ({
  activeTab,
  setActiveTab,
  viewMode,
  setViewMode,
  onOpen100SetsModal,
  isLoadingAi,
  userPhoto,
  userPhotoName,
  compositeTryOnImage,
  tryonEngineMode,
  selectedPant,
  extractedGarment,
  isScanningGarment,
  onScanGarment,
  fitResult,
  measurements,
  outfitItems,
  totalOutfitPrice,
  onAddWholeOutfitToCart,
  fileInputRef,
  onPhotoUpload,
  onClearUserPhoto,
  onSelectPresetModel,
  height,
  setHeight,
  weight,
  setWeight,
  physiqueInfo,
  currentBmi,
  onRunTryOn,
}) => {
  return (
    <div className="xl:col-span-5 space-y-4">
      <div className="bg-slate-900 rounded-3xl p-4 text-white shadow-xl border border-slate-800 flex flex-col justify-between">
        
        {/* Header thanh công cụ của Gương Thử Đồ */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('photo')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-xs ${
                activeTab === 'photo'
                  ? 'bg-emerald-600 text-white ring-1 ring-emerald-400/50'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              <span>📸</span> Ảnh Mặc Thử AI HD
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('scanner')
                if (!extractedGarment) onScanGarment()
              }}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                activeTab === 'scanner'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'
              }`}
            >
              <span>🔬</span> AI Bóc Tách Đồ
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('heatmap')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                activeTab === 'heatmap'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'
              }`}
            >
              <span>🔥</span> Áp Lực Vừa Vặn
            </button>
            <button
              type="button"
              onClick={onOpen100SetsModal}
              className="px-2.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 hover:brightness-110 shadow-xs flex items-center gap-1 transition cursor-pointer"
            >
              <span>✨</span> 100 Set Phối Đồ AI 🔥
            </button>
          </div>

          {/* Các nút chế độ khi đang ở tab Ảnh Mặc Thử */}
          {activeTab === 'photo' && (
            <div className="flex gap-1 bg-black/60 backdrop-blur-md p-1 rounded-xl border border-white/10 text-[10px]">
              <button
                type="button"
                onClick={() => setViewMode('tryon')}
                className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                  viewMode === 'tryon' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>✨</span> Ảnh Ướm AI
              </button>
              <button
                type="button"
                onClick={() => setViewMode('original')}
                className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                  viewMode === 'original' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>👤</span> Ảnh Gốc
              </button>
              <button
                type="button"
                onClick={() => setViewMode('sidebyside')}
                className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                  viewMode === 'sidebyside' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>↔</span> So Sánh
              </button>
            </div>
          )}
        </div>

        {/* Khung Display Chính: Chiều cao lớn h-[520px] chuẩn tỷ lệ Studio thời trang */}
        <div className="relative w-full h-[520px] bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-white/10 shadow-inner">
          
          {/* TAB 1: ẢNH MẶC THỬ THỰC TẾ (HERO) */}
          {activeTab === 'photo' && (
            <div className="relative w-full h-full flex items-center justify-center">
              
              {/* Trạng thái Loading khi AI đang chạy sinh ảnh */}
              {isLoadingAi && (
                <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
                  <div className="relative mb-4">
                    <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-xl">✨</div>
                  </div>
                  <h4 className="text-white font-black text-sm mb-1.5 flex items-center gap-2">
                    Đang xử lý Ảnh Mặc Thử AI HD...
                  </h4>
                  <p className="text-slate-400 text-xs max-w-sm leading-relaxed">
                    Hệ thống AI đang phân tích vóc dáng và hoán đổi trang phục sắc nét chuẩn Studio HD
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-[11px] text-indigo-400 font-bold bg-indigo-950/70 px-3.5 py-1.5 rounded-full border border-indigo-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    ZeroMall AI • Neural Try-On Pipeline
                  </div>
                </div>
              )}

              {/* Chế độ so sánh Song Song (Side by Side) */}
              {viewMode === 'sidebyside' ? (
                <div className="grid grid-cols-2 gap-3 w-full h-full p-3">
                  <div className="relative h-full rounded-xl overflow-hidden border border-white/10 bg-slate-900 shadow-md flex items-center justify-center">
                    {userPhoto ? (
                      <img
                        src={userPhoto}
                        alt="Original User"
                        className="w-full h-full object-contain bg-slate-900"
                      />
                    ) : (
                      <div className="text-center p-3">
                        <span className="text-2xl block mb-1">👤</span>
                        <span className="text-[11px] text-slate-400 font-bold">Chưa có ảnh của bạn</span>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-300 border border-white/10">
                      👤 Ảnh Gốc Ban Đầu
                    </div>
                  </div>
                  <div className="relative h-full rounded-xl overflow-hidden border-2 border-indigo-500/80 bg-slate-900 shadow-md flex items-center justify-center">
                    {compositeTryOnImage ? (
                      <img
                        src={compositeTryOnImage}
                        alt="AI Try-on Result"
                        className="w-full h-full object-contain bg-slate-900"
                      />
                    ) : (
                      <div className="text-center p-3">
                        <span className="text-2xl block mb-1">✨</span>
                        <span className="text-[11px] text-slate-400 font-bold">Chưa có ảnh ướm thử</span>
                        <p className="text-[10px] text-slate-500 mt-0.5">Bấm &quot;Ướm Cả Bộ&quot; để AI thử đồ</p>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 bg-gradient-to-r from-amber-600 to-indigo-600 px-3 py-1 rounded-lg text-[10px] font-black text-white shadow-md flex items-center gap-1.5">
                      <span>✨</span> ZeroMall AI • Ảnh Ướm Thử
                    </div>
                  </div>
                </div>
              ) : (
                /* Chế độ xem Đơn To Toàn Màn Hình */
                <div className="relative w-full h-full flex items-center justify-center p-2">
                  {compositeTryOnImage && viewMode === 'tryon' ? (
                    <>
                      <img
                        src={compositeTryOnImage}
                        alt="Visual Fitting Result"
                        className="max-h-full max-w-full object-contain rounded-xl shadow-2xl transition duration-300"
                      />
                      <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-full text-[11px] font-bold text-indigo-300 border border-white/15 flex items-center gap-2 shadow-xl">
                        <span className={`w-2.5 h-2.5 rounded-full ${tryonEngineMode === 'free' ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`}></span>
                        {tryonEngineMode === 'free' ? 'Ảnh Thử Đồ Local AI (0 Gem)' : 'Ảnh Thử Đồ Mage Ultra HD (~350 Gem)'}
                      </div>
                    </>
                  ) : userPhoto ? (
                    <>
                      <img
                        src={userPhoto}
                        alt="Original User"
                        className="max-h-full max-w-full object-contain rounded-xl shadow-2xl transition duration-300"
                      />
                      <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-full text-[11px] font-bold text-slate-300 border border-white/15 flex items-center gap-2 shadow-xl">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                        {viewMode === 'original' ? 'Ảnh gốc của bạn' : 'Ảnh gốc (Chưa ướm đồ - Bấm "Ướm Cả Bộ")'}
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-6 max-w-md animate-in fade-in duration-200">
                      <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center text-3xl shadow-inner">
                        📸
                      </div>
                      <h4 className="text-white font-black text-sm mb-1.5">Chưa có ảnh của bạn</h4>
                      <p className="text-slate-400 text-xs leading-relaxed mb-4">
                        Vui lòng tải ảnh của bạn lên để AI ướm thử trang phục chân thực nhất. Hệ thống không tự ý thử đồ khi bạn đang duyệt sản phẩm!
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 mx-auto cursor-pointer"
                      >
                        <span>+</span> Tải Ảnh Của Bạn Lên Ngay
                      </button>
                    </div>
                  )}

                  {selectedPant && ((selectedPant.name || '').toLowerCase().includes('quần') || (selectedPant.name || '').toLowerCase().includes('jean') || (selectedPant.name || '').toLowerCase().includes('jogger')) && (
                    <div className="absolute bottom-3 left-3 bg-indigo-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-bold text-indigo-200 border border-indigo-500/30 flex items-center gap-1.5 shadow-lg">
                      <span>👖</span> Đang ướm Quần vào đôi chân & vóc dáng toàn thân
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BỘ BÓC TÁCH & QUÉT TRANG PHỤC THÔNG MINH (AI GARMENT SCANNER) */}
          {activeTab === 'scanner' && (
            <div className="w-full h-full p-4 flex flex-col justify-between overflow-y-auto text-slate-200">
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2.5">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <span>🔬</span> Bộ Bóc Tách Trang Phục Từng Lớp (FashnHumanParser AI)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Tự động bóc tách vải, khử nền sạch 100%, tạo Alpha Matte & trích xuất bảng màu
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onScanGarment}
                    disabled={isScanningGarment}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    <span>⚡</span> {isScanningGarment ? 'Đang Quét...' : 'Quét Lại Món Này'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div className="bg-slate-900 rounded-xl p-2.5 border border-white/10 flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 self-start">
                      1. Ảnh Gốc Món Đồ
                    </span>
                    <div className="w-full h-52 rounded-lg overflow-hidden bg-slate-950 flex items-center justify-center border border-white/5">
                      <img
                        src={selectedPant?.image || ''}
                        alt="Garment Original"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1.5 text-center truncate max-w-full">
                      {selectedPant?.name}
                    </span>
                  </div>

                  <div className="bg-slate-900 rounded-xl p-2.5 border border-white/10 flex flex-col items-center">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1.5 self-start flex items-center gap-1">
                      <span>🎭</span> 2. Mặt Nạ Phân Đoạn AI
                    </span>
                    <div className="w-full h-52 rounded-lg overflow-hidden bg-black flex items-center justify-center border border-white/5 relative">
                      {extractedGarment?.mask_url ? (
                        <img
                          src={extractedGarment.mask_url}
                          alt="AI Garment Mask"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="text-center p-4">
                          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                          <span className="text-xs text-slate-400">Đang tạo mặt nạ nhị phân...</span>
                        </div>
                      )}
                      <div className="absolute bottom-1 right-1 bg-black/80 px-2 py-0.5 rounded text-[9px] font-mono text-emerald-400 border border-white/10">
                        {extractedGarment?.pixels_count ? `${extractedGarment.pixels_count.toLocaleString()} px` : 'Mask 0/1'}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1.5">
                      Nhãn: {extractedGarment?.detected_category?.toUpperCase() || 'CHƯA QUÉT'}
                    </span>
                  </div>

                  <div className="bg-slate-900 rounded-xl p-2.5 border border-white/10 flex flex-col items-center">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5 self-start flex items-center gap-1">
                      <span>✨</span> 3. Đồ Bóc Tách Sạch Nền
                    </span>
                    <div 
                      className="w-full h-52 rounded-lg overflow-hidden flex items-center justify-center border border-white/5 relative"
                      style={{
                        backgroundImage: `linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)`,
                        backgroundSize: '16px 16px',
                        backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
                      }}
                    >
                      {extractedGarment?.extracted_garment_url ? (
                        <img
                          src={extractedGarment.extracted_garment_url}
                          alt="Isolated Garment"
                          className="max-h-full max-w-full object-contain drop-shadow-2xl"
                        />
                      ) : (
                        <img
                          src={selectedPant?.image || ''}
                          alt="Isolated Garment"
                          className="max-h-full max-w-full object-contain opacity-70"
                        />
                      )}
                      <div className="absolute bottom-1 right-1 bg-emerald-950/80 px-2 py-0.5 rounded text-[9px] font-mono text-emerald-300 border border-emerald-500/30">
                        Alpha PNG 100%
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1.5">
                      Khung: {extractedGarment?.dimensions?.width || 0} × {extractedGarment?.dimensions?.height || 0} px
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900/90 rounded-xl p-3 border border-white/10 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-300">Bảng màu vải chủ đạo:</span>
                    <div className="flex items-center gap-1.5">
                      {(extractedGarment?.dominant_colors || ['#3b82f6', '#1e293b']).map((c, i) => (
                        <div key={i} className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-lg border border-white/10">
                          <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: c }}></span>
                          <span className="font-mono text-[10px] text-slate-300">{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('photo')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      <span>✨</span> Xem Ảnh Thử Bằng Neural AI
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BẢN ĐỒ ÁP LỰC VỪA VẶN */}
          {activeTab === 'heatmap' && fitResult && (
            <div className="w-full h-full p-6 flex flex-col justify-center space-y-3.5 max-w-md mx-auto text-slate-800">
              <h4 className="text-white font-bold text-center text-sm mb-2">🔥 Bản Đồ Áp Lực Co Giãn Vải Theo Vóc Dáng</h4>
              {Object.entries(fitResult.zones).map(([key, zone]) => (
                <div key={key} className="bg-white/95 backdrop-blur-md p-3 rounded-xl border border-white/20 space-y-1.5 shadow-md">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">{zone.label}</span>
                    <span
                      className="font-black px-2 py-0.5 rounded text-[10px]"
                      style={{ backgroundColor: `${zone.color}25`, color: zone.color }}
                    >
                      {zone.status}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(30, 85 - Math.abs(zone.diff_percent || zone.diff_cm || 0) * 3))}%`,
                        backgroundColor: zone.color
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Món Đồ Đang Mặc & Nút Thao Tác Nhanh */}
        {outfitItems.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex -space-x-2 overflow-hidden shrink-0">
                {outfitItems.map((item, idx) => (
                  <img
                    key={item.id + idx}
                    src={item.image || 'https://placehold.co/80x80'}
                    alt={item.name}
                    className="w-10 h-10 object-cover rounded-xl border-2 border-slate-900 bg-white shadow-sm"
                    title={item.name}
                  />
                ))}
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-wider block">
                  {outfitItems.length > 1 ? `Đang Phối Bộ ${outfitItems.length} Món` : 'Đang Thử Trên Người'}
                </span>
                <h4 className="font-bold text-white text-xs sm:text-sm truncate max-w-[280px]">
                  {outfitItems.map(i => i.name).join(' + ')}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-rose-400 font-black text-xs sm:text-sm">
                    {totalOutfitPrice.toLocaleString('vi-VN')}đ
                  </span>
                  <span className="text-emerald-400 font-bold text-[10px] bg-emerald-500/20 px-2 py-0.2 rounded-full border border-emerald-500/30">
                    Khớp vóc dáng: {fitResult?.fit_score || 95}% • Size {fitResult?.recommended_size || measurements?.recommended_pant_size || 'L'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {compositeTryOnImage && (
                <a
                  href={compositeTryOnImage}
                  download={`zeromall-outfit-${Date.now()}.jpg`}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 border border-white/10"
                  title="Tải ảnh mặc thử độ phân giải cao"
                >
                  <span>⬇</span> Tải Ảnh HD
                </a>
              )}
              <button
                type="button"
                onClick={onAddWholeOutfitToCart}
                className="px-4 py-2 bg-[#ee4d2d] hover:bg-[#d93b1d] text-white rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer shadow-md hover:shadow-lg active:scale-[0.98] flex items-center gap-1.5"
              >
                <span>🛒</span> {outfitItems.length > 1 ? `Thêm Trọn Bộ (${outfitItems.length} Món)` : 'Thêm Vào Giỏ Hàng'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* KHỐI 2: THÊM ẢNH NGƯỜI DÙNG ĐỂ THỬ ĐỒ (PROFILE & SỐ ĐO) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3.5 shadow-xl text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-xs sm:text-sm text-white flex items-center gap-1.5">
              <span>📸</span> Thêm Ảnh Người Dùng
            </h3>
            <p className="text-[11px] text-slate-400">
              {((selectedPant?.name || '').toLowerCase().includes('quần') || (selectedPant?.name || '').toLowerCase().includes('jean') || (selectedPant?.name || '').toLowerCase().includes('jogger'))
                ? 'AI nhận diện vóc dáng và ghép quần vào đôi chân (chân dung hoặc toàn thân)'
                : 'Tải ảnh của bạn để AI tự động ướm đồ lên người bạn'}
            </p>
          </div>
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            {height}cm • {weight}kg
          </span>
        </div>

        {/* Hero CTA Box: Bấm để chọn ảnh từ máy tính / điện thoại */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-emerald-400/60 hover:border-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/30 p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition group"
        >
          <div className="relative shrink-0">
            {userPhoto ? (
              <img
                src={userPhoto}
                alt="Avatar"
                className="w-13 h-13 sm:w-14 sm:h-14 object-cover rounded-xl border border-emerald-400/50 shadow-sm group-hover:scale-105 transition bg-slate-900"
              />
            ) : (
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-xl border-2 border-dashed border-emerald-400/50 bg-emerald-900/30 flex items-center justify-center text-xl">
                👤
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] shadow">
              📷
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-black text-white group-hover:text-emerald-300 flex items-center gap-1">
              <span>+</span> Tải Ảnh Của Bạn Lên Đây
            </p>
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-[11px] text-slate-400 truncate">
                Đang dùng: <span className="font-bold text-slate-200">{userPhoto ? (userPhotoName || 'Ảnh của bạn') : 'Chưa có ảnh'}</span>
              </p>
              {userPhoto && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onClearUserPhoto()
                  }}
                  className="text-[10px] text-rose-400 hover:text-rose-300 font-bold ml-2 underline shrink-0 cursor-pointer"
                >
                  Xóa ảnh
                </button>
              )}
            </div>
            <span className="text-[10px] text-emerald-400 font-bold block mt-0.5 group-hover:underline">
              Chọn file ảnh từ thiết bị (JPG, PNG) ➔
            </span>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onPhotoUpload}
          className="hidden"
        />

        {/* Quick Model Selector Pills */}
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Hoặc chọn nhanh ảnh mẫu thử có sẵn:
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSelectPresetModel('https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&q=80', 'Người Mẫu Nam', 'male')}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer truncate ${
                userPhoto.includes('photo-1506794778202')
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <span>👨</span> Người Mẫu Nam
            </button>
            <button
              type="button"
              onClick={() => onSelectPresetModel('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80', 'Người Mẫu Nữ', 'female')}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer truncate ${
                userPhoto.includes('photo-1534528741775')
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <span>👩</span> Người Mẫu Nữ
            </button>
          </div>
        </div>

        {/* Nhập Chiều cao & Cân nặng để AI tự động tính vóc dáng */}
        <div className="pt-2.5 border-t border-slate-800 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Chiều cao (cm)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="120"
                  max="220"
                  value={height || ''}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  placeholder="175"
                  className="w-full px-2.5 py-1.5 text-xs font-black text-white bg-slate-800 border border-slate-700 rounded-xl focus:bg-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  cm
                </span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Cân nặng (kg)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="30"
                  max="150"
                  value={weight || ''}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  placeholder="50"
                  className="w-full px-2.5 py-1.5 text-xs font-black text-white bg-slate-800 border border-slate-700 rounded-xl focus:bg-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  kg
                </span>
              </div>
            </div>
          </div>

          {/* Thông tin vóc dáng AI tự tính & Nút cập nhật số đo */}
          <div className="flex items-center justify-between text-[11px] bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700">
            <span className="text-slate-300 truncate">
              Vóc dáng: <strong className="text-indigo-300">{physiqueInfo.badge}</strong> (BMI {currentBmi})
            </span>
            <button
              type="button"
              disabled={isLoadingAi || !selectedPant || !height || !weight}
              onClick={onRunTryOn}
              className="text-emerald-400 hover:text-emerald-300 font-black text-[11px] shrink-0 ml-2 hover:underline cursor-pointer disabled:opacity-50"
            >
              Áp dụng ➔
            </button>
          </div>
        </div>
      </div>

      {/* KHỐI 3: LỜI KHUYÊN TỪ AI STYLIST */}
      {fitResult && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-3xl p-3.5 flex items-start gap-2.5 text-xs text-emerald-200 leading-relaxed shadow-md">
          <span className="text-base shrink-0">💡</span>
          <div>
            <p className="font-black text-emerald-300 text-xs mb-0.5">Phân Tích AI Stylist:</p>
            <p className="text-[11px] text-emerald-200/90">{fitResult.stylist_fit_advice}</p>
          </div>
        </div>
      )}
    </div>
  )
}
