import React from 'react'
import type { Product } from '../../FlashSale'
import type { BodyMeasurements, ExtractedGarment, FitResult, TryonEngineMode } from './types'
import { formatCurrencyVND } from '../../../../utils/formatters'

interface TryOnMirrorStudioProps {
  activeTab: 'photo' | 'scanner' | 'heatmap'
  setActiveTab: (tab: 'photo' | 'scanner' | 'heatmap') => void
  viewMode: 'tryon' | 'original' | 'sidebyside'
  setViewMode: (mode: 'tryon' | 'original' | 'sidebyside') => void
  onOpen100SetsModal?: () => void
  isLoadingAi: boolean
  userPhoto: string
  userPhotoName: string
  compositeTryOnImage: string
  tryonEngineMode?: TryonEngineMode
  selectedPant: Product | null
  extractedGarment?: ExtractedGarment | null
  isScanningGarment?: boolean
  onScanGarment?: () => void
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
  setGender: (g: 'male' | 'female') => void
  physiqueInfo: { badge: string }
  currentBmi: number
  onRunTryOn: () => void
}

export const TryOnMirrorStudio: React.FC<TryOnMirrorStudioProps> = ({
  activeTab,
  setActiveTab,
  viewMode,
  setViewMode,
  isLoadingAi,
  userPhoto,
  userPhotoName,
  compositeTryOnImage,
  selectedPant,
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
  gender,
  setGender,
  physiqueInfo,
  currentBmi,
  onRunTryOn,
}) => {
  return (
    <div className="xl:col-span-5 space-y-4">
      {/* KHUNG GƯƠNG THỬ ĐỒ CHÍNH */}
      <div className="bg-white rounded-2xl p-4 shadow-2xs border border-slate-200 flex flex-col justify-between">
        
        {/* Thanh công cụ xem ảnh tối giản (Chỉ 1 nhóm nút rõ ràng) */}
        <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100">
          <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => {
                setActiveTab('photo')
                setViewMode('tryon')
              }}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'photo' && viewMode === 'tryon'
                  ? 'bg-white text-[#ee4d2d] shadow-2xs font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              <span>✨</span> Ảnh Ướm AI
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('photo')
                setViewMode('original')
              }}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'photo' && viewMode === 'original'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              <span>👤</span> Ảnh Gốc
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('photo')
                setViewMode('sidebyside')
              }}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'photo' && viewMode === 'sidebyside'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              <span>↔</span> So Sánh
            </button>
          </div>

          {/* Nút xem chi tiết vừa vặn vải (Tùy chọn phụ, gọn gàng) */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'heatmap' ? 'photo' : 'heatmap')}
            className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
              activeTab === 'heatmap'
                ? 'bg-orange-50 text-[#ee4d2d] border border-orange-200 font-semibold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
            title="Xem bản đồ áp lực vừa vặn của trang phục"
          >
            <span>🔥</span> {activeTab === 'heatmap' ? 'Đóng xem vải' : 'Độ vừa vặn'}
          </button>
        </div>

        {/* Khung Display Chính: Chiều cao lớn h-[520px] chuẩn tỷ lệ Studio thời trang */}
        <div className="relative w-full h-[520px] bg-slate-50/80 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200/80">
          
          {/* Trạng thái Loading khi AI đang chạy sinh ảnh */}
          {isLoadingAi && (
            <div className="absolute inset-0 z-30 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
              <div className="relative mb-3">
                <div className="w-12 h-12 rounded-full border-3 border-orange-200 border-t-[#ee4d2d] animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-sm">✨</div>
              </div>
              <h4 className="text-slate-900 font-bold text-sm mb-1">
                AI đang ươm trang phục lên người bạn...
              </h4>
              <p className="text-slate-500 text-xs max-w-xs leading-relaxed">
                Phân tích vóc dáng ({height}cm • {weight}kg) và căn chỉnh phom áo quần chuẩn xác
              </p>
            </div>
          )}

          {/* TAB: BẢN ĐỒ ÁP LỰC VỪA VẶN (NẾU ĐƯỢC CHỌN) */}
          {activeTab === 'heatmap' && fitResult ? (
            <div className="w-full h-full p-6 flex flex-col justify-center space-y-3.5 max-w-md mx-auto">
              <div className="text-center mb-2">
                <h4 className="text-slate-900 font-bold text-sm">Độ Co Giãn & Vừa Vặn Theo Vóc Dáng</h4>
                <p className="text-xs text-slate-500">Mô phỏng lực căng trên các vùng cơ thể</p>
              </div>
              {Object.entries(fitResult.zones).map(([key, zone]) => (
                <div key={key} className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-800">{zone.label}</span>
                    <span
                      className="font-bold px-2 py-0.5 rounded text-[10px]"
                      style={{ backgroundColor: `${zone.color}15`, color: zone.color }}
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
              <button
                type="button"
                onClick={() => setActiveTab('photo')}
                className="mt-2 text-xs font-semibold text-[#ee4d2d] hover:underline text-center"
              >
                Quay lại ảnh thử ➔
              </button>
            </div>
          ) : viewMode === 'sidebyside' ? (
            /* Chế độ so sánh Song Song (Side by Side) */
            <div className="grid grid-cols-2 gap-3 w-full h-full p-3">
              <div className="relative h-full rounded-xl overflow-hidden border border-slate-200 bg-white shadow-2xs flex items-center justify-center">
                {userPhoto ? (
                  <img
                    src={userPhoto}
                    alt="Original User"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-3">
                    <span className="text-2xl block mb-1">👤</span>
                    <span className="text-xs text-slate-400 font-medium">Chưa có ảnh của bạn</span>
                  </div>
                )}
                <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[10px] font-semibold text-white">
                  Ảnh gốc ban đầu
                </div>
              </div>
              <div className="relative h-full rounded-xl overflow-hidden border-2 border-[#ee4d2d]/60 bg-white shadow-2xs flex items-center justify-center">
                {compositeTryOnImage ? (
                  <img
                    src={compositeTryOnImage}
                    alt="AI Try-on Result"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-3">
                    <span className="text-2xl block mb-1">✨</span>
                    <span className="text-xs text-slate-400 font-medium">Chưa có ảnh ướm thử</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">Bấm &quot;Ướm Thử&quot; để AI mặc đồ</p>
                  </div>
                )}
                <div className="absolute top-2 left-2 bg-[#ee4d2d] px-2.5 py-1 rounded-lg text-[10px] font-bold text-white shadow-xs">
                  ✨ Ảnh ướm thử AI
                </div>
              </div>
            </div>
          ) : (
            /* Chế độ xem Đơn Toàn Khung */
            <div className="relative w-full h-full flex items-center justify-center p-2">
              {compositeTryOnImage && viewMode === 'tryon' ? (
                <>
                  <img
                    src={compositeTryOnImage}
                    alt="Visual Fitting Result"
                    className="max-h-full max-w-full object-contain rounded-xl shadow-sm transition duration-300"
                  />
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs px-3 py-1 rounded-full text-xs font-semibold text-slate-700 border border-slate-200/80 flex items-center gap-1.5 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Ảnh Ướm AI Siêu Thực (Ultra HD)
                  </div>
                </>
              ) : userPhoto ? (
                <>
                  <img
                    src={userPhoto}
                    alt="Original User"
                    className="max-h-full max-w-full object-contain rounded-xl shadow-sm transition duration-300"
                  />
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs px-3 py-1 rounded-full text-xs font-medium text-slate-600 border border-slate-200/80 flex items-center gap-1.5 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    {viewMode === 'original' ? 'Ảnh gốc của bạn' : 'Ảnh gốc (Chưa ướm đồ - Bấm "Ướm Thử")'}
                  </div>
                </>
              ) : (
                <div className="text-center p-6 max-w-xs animate-in fade-in duration-200">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-2xl text-[#ee4d2d]">
                    📸
                  </div>
                  <h4 className="text-slate-900 font-bold text-sm mb-1">Chưa có ảnh của bạn</h4>
                  <p className="text-slate-500 text-xs leading-relaxed mb-4">
                    Tải ảnh toàn thân hoặc chân dung để AI ươm thử trang phục chân thực nhất.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-[#ee4d2d] hover:bg-[#d93b1d] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                  >
                    <span>+</span> Tải Ảnh Của Bạn Lên
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Món Đồ Đang Thử (Gọn gàng, thanh lịch) */}
        {outfitItems.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex -space-x-2 overflow-hidden shrink-0">
                {outfitItems.map((item, idx) => (
                  <img
                    key={item.id + idx}
                    src={item.image || 'https://placehold.co/80x80'}
                    alt={item.name}
                    className="w-10 h-10 object-cover rounded-xl border-2 border-white bg-slate-100 shadow-2xs"
                    title={item.name}
                  />
                ))}
              </div>
              <div className="min-w-0">
                <h4 className="font-semibold text-slate-800 text-xs truncate max-w-[260px]">
                  {outfitItems.map(i => i.name).join(' + ')}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[#ee4d2d] font-bold text-xs sm:text-sm">
                    {formatCurrencyVND(totalOutfitPrice)}
                  </span>
                  <span className="text-emerald-700 font-semibold text-[10px] bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-200">
                    Khớp {fitResult?.fit_score || 95}% • Size {fitResult?.recommended_size || measurements?.recommended_pant_size || 'L'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {compositeTryOnImage && (
                <a
                  href={compositeTryOnImage}
                  download={`zeromall-tryon-${Date.now()}.jpg`}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                  title="Tải ảnh mặc thử về thiết bị"
                >
                  <span>⬇</span> Tải Ảnh
                </a>
              )}
              <button
                type="button"
                onClick={onAddWholeOutfitToCart}
                className="px-3.5 py-2 bg-[#ee4d2d] hover:bg-[#d93b1d] text-white rounded-xl text-xs font-bold transition duration-150 cursor-pointer shadow-xs active:scale-[0.98] flex items-center gap-1.5"
              >
                <span>🛒</span> {outfitItems.length > 1 ? `Thêm Cả Bộ (${outfitItems.length})` : 'Thêm Vào Giỏ'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* KHỐI 2: THÊM ẢNH NGƯỜI DÙNG & SỐ ĐO THỂ HÌNH */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs text-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
              <span>👤</span> Hồ Sơ & Ảnh Người Dùng
            </h3>
            <p className="text-[11px] text-slate-400">
              {selectedPant && ((selectedPant.name || '').toLowerCase().includes('quần') || (selectedPant.name || '').toLowerCase().includes('jean'))
                ? 'AI sẽ ghép quần chuẩn phom chân và vóc dáng'
                : 'Tải ảnh của bạn để AI tự động ướm đồ lên cơ thể'}
            </p>
          </div>
          <span className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
            {height}cm • {weight}kg
          </span>
        </div>

        {/* Khung tải ảnh người dùng */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border border-dashed border-slate-300 hover:border-[#ee4d2d] bg-slate-50/60 hover:bg-orange-50/20 p-3 rounded-xl flex items-center gap-3 cursor-pointer transition group"
        >
          <div className="relative shrink-0">
            {userPhoto ? (
              <img
                src={userPhoto}
                alt="Avatar"
                className="w-12 h-12 object-cover rounded-xl border border-slate-200 shadow-2xs group-hover:scale-105 transition bg-white"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center text-lg text-slate-400">
                📷
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-800 group-hover:text-[#ee4d2d] flex items-center gap-1">
              <span>+</span> {userPhoto ? 'Đổi Ảnh Của Bạn' : 'Tải Ảnh Của Bạn Lên'}
            </p>
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-[11px] text-slate-500 truncate">
                Đang dùng: <span className="font-medium text-slate-700">{userPhoto ? (userPhotoName || 'Ảnh của bạn') : 'Chưa có ảnh'}</span>
              </p>
              {userPhoto && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onClearUserPhoto()
                  }}
                  className="text-[11px] text-rose-500 hover:text-rose-600 font-medium ml-2 underline shrink-0 cursor-pointer"
                >
                  Xóa
                </button>
              )}
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onPhotoUpload}
          className="hidden"
        />

        {/* Chọn nhanh ảnh mẫu có sẵn */}
        <div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Hoặc chọn ảnh mẫu có sẵn:
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSelectPresetModel('https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&q=80', 'Người Mẫu Nam', 'male')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition flex items-center justify-center gap-1.5 cursor-pointer truncate ${
                userPhoto.includes('photo-1506794778202')
                  ? 'bg-orange-50 text-[#ee4d2d] border-[#ee4d2d] font-bold'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <span>👨</span> Mẫu Nam
            </button>
            <button
              type="button"
              onClick={() => onSelectPresetModel('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80', 'Người Mẫu Nữ', 'female')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition flex items-center justify-center gap-1.5 cursor-pointer truncate ${
                userPhoto.includes('photo-1534528741775')
                  ? 'bg-orange-50 text-[#ee4d2d] border-[#ee4d2d] font-bold'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <span>👩</span> Mẫu Nữ
            </button>
          </div>
        </div>

        {/* Lựa chọn giới tính thời trang */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-700 block">Giới tính trang phục:</span>
            <span className="text-[10px] text-slate-400">AI tự động lọc đồ nam hoặc nữ</span>
          </div>
          <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setGender('male')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                gender === 'male'
                  ? 'bg-[#ee4d2d] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>👨</span> Nam
            </button>
            <button
              type="button"
              onClick={() => setGender('female')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                gender === 'female'
                  ? 'bg-[#ee4d2d] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>👩</span> Nữ
            </button>
          </div>
        </div>

        {/* Nhập Chiều cao & Cân nặng */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
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
                  className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl focus:border-[#ee4d2d] focus:outline-hidden transition"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                  cm
                </span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Cân nặng (kg)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="30"
                  max="150"
                  value={weight || ''}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  placeholder="68"
                  className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl focus:border-[#ee4d2d] focus:outline-hidden transition"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                  kg
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/60">
            <span className="text-slate-600 truncate">
              Vóc dáng: <strong className="text-slate-800">{physiqueInfo.badge}</strong> (BMI {currentBmi})
            </span>
            <button
              type="button"
              disabled={isLoadingAi || !selectedPant || !height || !weight}
              onClick={onRunTryOn}
              className="text-[#ee4d2d] hover:text-[#d93b1d] font-bold text-[11px] shrink-0 ml-2 hover:underline cursor-pointer disabled:opacity-40"
            >
              Cập nhật ➔
            </button>
          </div>
        </div>
      </div>

      {/* LỜI KHUYÊN TỪ AI STYLIST */}
      {fitResult && (
        <div className="bg-orange-50/70 border border-orange-200/80 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed shadow-2xs">
          <span className="text-base shrink-0 text-[#ee4d2d]">💡</span>
          <div>
            <p className="font-bold text-[#ee4d2d] text-xs mb-0.5">Lời Khuyên Từ Stylist:</p>
            <p className="text-[11px] text-slate-600">{fitResult.stylist_fit_advice}</p>
          </div>
        </div>
      )}
    </div>
  )
}
