import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { API_BASE_URL, TRYON_SERVICE_URL } from '../../config/api.config'
import { formatCurrencyVND } from '../../utils/formatters'
import type { Product } from '../../components/buyer/FlashSale'

interface BodyMeasurements {
  bmi: number
  body_type: string
  shape_class: string
  height_cm: number
  weight_kg: number
  gender: string
  chest_cm: number
  waist_cm: number
  hip_cm: number
  thigh_cm: number
  shoulder_cm: number
  inseam_cm: number
  outseam_cm: number
  recommended_pant_size: string
}

interface FitZone {
  label: string
  diff_percent?: number
  diff_cm?: number
  status: string
  status_code: string
  color: string
}

interface FitResult {
  fit_score: number
  recommended_size: string
  zones: {
    waist: FitZone
    hip: FitZone
    thigh: FitZone
    length: FitZone
  }
  verdict: string
  stylist_fit_advice: string
}

interface OutfitItem {
  role: string
  product: Product
}

interface OutfitLook {
  id: string
  title: string
  tag: string
  vibe: string
  stylist_note: string
  items: OutfitItem[]
  total_price: number
}

export const VirtualTryOnPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialProductId = searchParams.get('productId')

  // 1. Dữ liệu đầu vào
  const [height, setHeight] = useState<number>(175)
  const [weight, setWeight] = useState<number>(68)
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [userPhoto, setUserPhoto] = useState<string>('https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&q=80')
  const [isCustomPhoto, setIsCustomPhoto] = useState<boolean>(false)

  // 2. Danh sách trang phục thực tế từ ZeroMall
  const [availablePants, setAvailablePants] = useState<Product[]>([])
  const [selectedPant, setSelectedPant] = useState<Product | null>(null)
  const [isLoadingPants, setIsLoadingPants] = useState<boolean>(true)

  // 3. Kết quả AI
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false)
  const [measurements, setMeasurements] = useState<BodyMeasurements | null>(null)
  const [fitResult, setFitResult] = useState<FitResult | null>(null)
  const [outfits, setOutfits] = useState<OutfitLook[]>([])
  const [activeTab, setActiveTab] = useState<'photo' | 'heatmap'>('photo')

  // Tải danh sách quần áo thời trang thực tế từ ZeroMall
  useEffect(() => {
    const fetchRealPants = async () => {
      setIsLoadingPants(true)
      try {
        const res = await fetch(`${API_BASE_URL}/products?page=1&limit=50`)
        if (res.ok) {
          const raw = await res.json()
          const prods: Product[] = Array.isArray(raw) ? raw : (raw.products || [])
          // Lọc ra các sản phẩm quần hoặc thời trang
          const pantsList = prods.filter((p) => {
            const name = (p.name || '').toLowerCase()
            const cat = (p.category || '').toLowerCase()
            return name.includes('quần') || name.includes('jean') || name.includes('jogger') || cat.includes('thời trang') || name.includes('áo') || name.includes('váy')
          })

          let effectivePants = pantsList.length > 0 ? pantsList : prods.slice(0, 4)

          if (initialProductId) {
            let matched = effectivePants.find((p) => p.id === initialProductId)
            if (!matched) {
              try {
                const prodRes = await fetch(`${API_BASE_URL}/products/${initialProductId}`)
                if (prodRes.ok) {
                  const fetchedProd = await prodRes.json()
                  if (fetchedProd && fetchedProd.id) {
                    matched = fetchedProd
                    effectivePants = [fetchedProd, ...effectivePants]
                  }
                }
              } catch (eF) {
                console.warn('[VirtualTryOnPage] Failed to fetch initial product details:', eF)
              }
            }
            setAvailablePants(effectivePants)
            setSelectedPant(matched || effectivePants[0])
          } else {
            setAvailablePants(effectivePants)
            setSelectedPant(effectivePants[0] || null)
          }
        }
      } catch (e) {
        console.error('Lỗi khi tải sản phẩm ZeroMall:', e)
      } finally {
        setIsLoadingPants(false)
      }
    }

    fetchRealPants()
  }, [initialProductId])

  // Kích hoạt AI tính toán thử đồ
  const handleRunTryOn = async () => {
    if (!selectedPant) return
    setIsLoadingAi(true)

    try {
      const res = await fetch(`${TRYON_SERVICE_URL}/api/tryon/full-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          height_cm: height,
          weight_kg: weight,
          gender: gender,
          pant: selectedPant,
          user_image: userPhoto
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setMeasurements(data.measurements)
          setFitResult(data.fit)
          setOutfits(data.outfits || [])
        }
      } else {
        alert('Không thể kết nối đến AI Try-On Service. Vui lòng đảm bảo server cổng 5006 đang chạy.')
      }
    } catch (e: any) {
      console.error('Try-on API error:', e)
      alert('Lỗi kết nối Local AI Service (Port 5006): ' + e.message)
    } finally {
      setIsLoadingAi(false)
    }
  }

  // Tự động chạy lần đầu khi đã có sản phẩm
  useEffect(() => {
    if (selectedPant && !measurements) {
      handleRunTryOn()
    }
  }, [selectedPant])

  // Đổi avatar người dùng mẫu
  const handleSelectPresetModel = (presetGender: 'male' | 'female') => {
    setGender(presetGender)
    if (presetGender === 'male') {
      setHeight(175)
      setWeight(68)
      setUserPhoto('https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&q=80')
    } else {
      setHeight(163)
      setWeight(49)
      setUserPhoto('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80')
    }
    setIsCustomPhoto(false)
  }

  const handleCustomPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          setUserPhoto(event.target.result as string)
          setIsCustomPhoto(true)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 font-sans text-slate-800">
      {/* 1. Header Banner */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl mb-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                AI Thử Đồ Tức Thì
              </span>
              <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-400/20 text-[11px] font-bold px-3 py-1 rounded-full">
                Ướm Thử Qua Ảnh Chân Thực
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>Phòng Thử Đồ Ảo AI (Virtual Try-On)</span>
              <span className="text-xl">✨</span>
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1.5 max-w-2xl leading-relaxed">
              Ướm thử trang phục trực tiếp lên ảnh chân dung của bạn kết hợp phân tích số đo chiều cao/cân nặng. Đo áp lực độ vừa vặn và nhận tư vấn phối đồ từ Stylist AI.
            </p>
          </div>

          <button
            onClick={() => navigate('/')}
            className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-4 py-2.5 rounded-xl border border-white/20 transition cursor-pointer flex items-center gap-2 shrink-0 active:scale-[0.98]"
          >
            ← Về Sàn Mua Sắm
          </button>
        </div>
      </div>

      {/* 2. Main Grid: Controls & AI Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Cột 1: Bảng Điều Khiển Vóc Dáng & Trang Phục (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card 1: Thông số thể hình */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-4">
              <span>📐</span> Thông Số Vóc Dáng Của Bạn
            </h3>

            {/* Giới tính */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Giới tính</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectPresetModel('male')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    gender === 'male'
                      ? 'border-indigo-600 bg-indigo-50/60 text-indigo-700'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <span>👨</span> Nam
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPresetModel('female')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    gender === 'female'
                      ? 'border-pink-500 bg-pink-50/60 text-pink-700'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <span>👩</span> Nữ
                </button>
              </div>
            </div>

            {/* Slider Chiều cao */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-500">Chiều cao</span>
                <span className="font-black text-slate-800">{height} cm</span>
              </div>
              <input
                type="range"
                min="140"
                max="205"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>140 cm</span>
                <span>205 cm</span>
              </div>
            </div>

            {/* Slider Cân nặng */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-500">Cân nặng</span>
                <span className="font-black text-slate-800">{weight} kg</span>
              </div>
              <input
                type="range"
                min="40"
                max="125"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>40 kg</span>
                <span>125 kg</span>
              </div>
            </div>

            {/* Upload ảnh người thật */}
            <div className="pt-3 border-t border-slate-100">
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                Ảnh Toàn Thân / Chân Dung Của Bạn
              </label>
              <div className="flex items-center gap-3">
                <img
                  src={userPhoto}
                  alt="User avatar"
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                />
                <div className="flex-1">
                  <label className="inline-block bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-1.5 px-3 rounded-lg cursor-pointer transition">
                    Tải Ảnh Của Bạn
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCustomPhotoUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {isCustomPhoto ? 'Đang dùng ảnh tải lên của bạn' : 'Đang dùng ảnh người mẫu chuẩn'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Chọn Món Đồ Cần Thử Trên ZeroMall */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80">
            <h3 className="font-bold text-slate-900 text-sm flex items-center justify-between mb-4">
              <span className="flex items-center gap-2">
                <span>👖</span> Món Đồ Đang Ướm Thử
              </span>
              <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                {availablePants.length} sản phẩm
              </span>
            </h3>

            {isLoadingPants ? (
              <div className="py-8 text-center text-xs text-slate-400">Đang tải danh mục quần áo ZeroMall...</div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {availablePants.map((pant) => {
                  const isSelected = selectedPant?.id === pant.id
                  return (
                    <div
                      key={pant.id}
                      onClick={() => setSelectedPant(pant)}
                      className={`p-2.5 rounded-xl border flex items-center gap-3 cursor-pointer transition ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-2xs'
                          : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'
                      }`}
                    >
                      <img
                        src={pant.image}
                        alt={pant.name}
                        className="w-12 h-12 rounded-lg object-cover bg-slate-100 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold line-clamp-1 ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                          {pant.name}
                        </p>
                        <p className="text-xs font-black text-rose-600 mt-0.5">
                          {formatCurrencyVND(pant.price)}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] shrink-0 font-bold">
                          ✓
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Nút hành động AI Re-calculate */}
            <button
              type="button"
              disabled={isLoadingAi || !selectedPant}
              onClick={handleRunTryOn}
              className={`w-full mt-5 py-3.5 px-4 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-md ${
                isLoadingAi
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white'
              }`}
            >
              {isLoadingAi ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  AI Đang Ướm Thử Đồ Qua Ảnh...
                </>
              ) : (
                <>
                  <span>✨</span>
                  Ướm Thử Qua Ảnh Ngay
                </>
              )}
            </button>
          </div>
        </div>

        {/* Cột 2 & 3: Khu Vực Hiển Thị Thử Đồ & Kết Quả (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Main Visualizer Stage */}
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80">
            {/* Visualizer Mode Tabs */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('photo')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'photo'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>📸</span> Ảnh Mặc Thử Chân Thực
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('heatmap')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'heatmap'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>🔥</span> Bản Đồ Áp Lực Vừa Vặn
                </button>
              </div>
            </div>

            {/* Visualizer Render Output */}
            <div className="relative w-full h-[450px] bg-gradient-to-b from-slate-50 to-slate-100/70 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-200/50">
              
              {/* Chế độ 1: Ảnh Mặc Thử Chân Thực (Virtual Try-On Render) */}
              {activeTab === 'photo' && (
                <div className="relative w-full h-full flex items-center justify-center p-4">
                  <div className="relative max-h-full aspect-3/4 rounded-xl overflow-hidden shadow-md border border-slate-200">
                    <img
                      src={userPhoto}
                      alt="Model tryon"
                      className="w-full h-full object-cover"
                    />
                    {/* Layer phủ chiếc quần đã uốn theo dáng người */}
                    {selectedPant && (
                      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/50 via-transparent to-transparent flex items-end p-4">
                        <div className="bg-white/95 backdrop-blur-xs p-2.5 rounded-xl shadow-lg border border-slate-100 text-xs">
                          <p className="font-bold text-slate-800 line-clamp-1">{selectedPant.name}</p>
                          <p className="text-[11px] font-black text-indigo-600 mt-0.5">
                            Độ khớp: {fitResult?.fit_score || 93}%
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Chế độ 2: Heatmap Áp Lực Vừa Vặn */}
              {activeTab === 'heatmap' && fitResult && (
                <div className="w-full max-w-md p-6 bg-white/95 backdrop-blur-xs rounded-2xl shadow-md border border-slate-200/80 space-y-4">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <span>🔥</span> Phân Bổ Áp Lực Co Giãn Vải Theo Vóc Dáng
                  </h4>
                  {Object.entries(fitResult.zones).map(([key, zone]) => (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-600">{zone.label}</span>
                        <span
                          className="font-bold px-2 py-0.5 rounded text-[10px]"
                          style={{ backgroundColor: `${zone.color}20`, color: zone.color }}
                        >
                          {zone.status}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(15, (zone.diff_percent || 0) + 50))}%`,
                            backgroundColor: zone.color
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-100 flex items-center justify-between">
                    <span>🔴 Rất chật / Căng</span>
                    <span>🟢 Rất vừa vặn</span>
                    <span>🟡 Rộng rãi / Thoải mái</span>
                  </div>
                </div>
              )}
            </div>

            {/* Bảng Chỉ Số Nhân Trắc Học Thực Tế Từ AI */}
            {measurements && (
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-center">
                  <span className="text-[11px] text-slate-500 block font-medium">Vòng Eo (Waist)</span>
                  <span className="font-black text-slate-800 text-base">{measurements.waist_cm} cm</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-center">
                  <span className="text-[11px] text-slate-500 block font-medium">Vòng Mông (Hip)</span>
                  <span className="font-black text-slate-800 text-base">{measurements.hip_cm} cm</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-center">
                  <span className="text-[11px] text-slate-500 block font-medium">Vòng Đùi (Thigh)</span>
                  <span className="font-black text-slate-800 text-base">{measurements.thigh_cm} cm</span>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl text-center">
                  <span className="text-[11px] text-indigo-700 block font-bold">Size Quần Khuyên Dùng</span>
                  <span className="font-black text-indigo-700 text-base">{measurements.recommended_pant_size}</span>
                </div>
              </div>
            )}
          </div>

          {/* AI Fit Verdict & Stylist Advice */}
          {fitResult && (
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <span>✨</span> Đánh Giá Độ Vừa Vặn Của AI Cho "{selectedPant?.name}"
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{fitResult.verdict}</p>
                </div>
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                  <span className="text-xs text-emerald-700 font-bold">Điểm vừa vặn:</span>
                  <span className="text-sm font-black text-emerald-800">{fitResult.fit_score}/100</span>
                </div>
              </div>

              {/* Lời khuyên Stylist */}
              <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl text-xs text-slate-700 leading-relaxed flex items-start gap-3">
                <span className="text-xl shrink-0">💡</span>
                <div>
                  <p className="font-bold text-slate-900 mb-0.5">Lời khuyên từ AI Stylist:</p>
                  <p>{fitResult.stylist_fit_advice}</p>
                </div>
              </div>
            </div>
          )}

          {/* Gợi Ý Phối Đồ Hoàn Chỉnh (Outfits) Từ AI Stylist */}
          {outfits.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-4">
                <span>🧥</span> Gợi Ý Phối Đồ Chuẩn Phong Cách Cho Món Đồ Này
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {outfits.map((outfit) => (
                  <div
                    key={outfit.id}
                    className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-black text-xs text-slate-900">{outfit.title}</span>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-bold text-[10px]">
                          {outfit.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 italic mb-3">"{outfit.stylist_note}"</p>

                      {/* Items trong outfit */}
                      <div className="space-y-1.5 mb-3">
                        {outfit.items.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-100">
                            <span className="text-slate-600 line-clamp-1 max-w-[200px]">{it.product.name}</span>
                            <span className="font-bold text-slate-900 shrink-0">{formatCurrencyVND(it.product.price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-200/60">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Tổng set đồ:</span>
                        <span className="text-xs font-black text-rose-600">{formatCurrencyVND(outfit.total_price)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/checkout`)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                      >
                        Mua Cả Set ➔
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
