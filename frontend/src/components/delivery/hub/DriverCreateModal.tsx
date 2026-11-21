import React, { useState, useEffect, useMemo, useRef } from 'react'
import { API_BASE_URL } from '../../../config/api.config'
import type { Hub } from './types'
import vietnamAddressData from '../../../data/vietnam-address-tree.json'
import { cleanAdminName } from '../../../utils/vietnameseTones'

interface ProvinceItem {
  name: string
  code: number
  districts: DistrictItem[]
}

interface DistrictItem {
  name: string
  code: number
  wards: WardItem[]
}

interface WardItem {
  name: string
  code: number
}

export interface DriverCreateModalProps {
  isOpen: boolean
  onClose: () => void
  currentHub: Hub | null
  onSuccess: () => void
  initialVehicleType?: 'MOTORBIKE' | 'VAN' | 'TRUCK'
}

export const DriverCreateModal: React.FC<DriverCreateModalProps> = ({
  isOpen,
  onClose,
  currentHub,
  onSuccess,
  initialVehicleType = 'MOTORBIKE',
}) => {
  const isSoc = currentHub?.type === 'SORTING_CENTER'

  // Form states
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [vehicleType, setVehicleType] = useState<string>(isSoc ? 'TRUCK' : initialVehicleType)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('123456')
  const [showPassword, setShowPassword] = useState(false)
  const [customRouteNote, setCustomRouteNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Location & Area Selection states
  const [activeTab, setActiveTab] = useState<'AREAS' | 'MAP'>('AREAS')
  const [selectedDistrictName, setSelectedDistrictName] = useState<string>('')
  const [selectedWards, setSelectedWards] = useState<string[]>([])

  // Map state
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const circleInstanceRef = useRef<any>(null)

  // Lấy dữ liệu Tỉnh/Thành của Bưu cục từ cây địa giới hành chính
  const hubProvinceData = useMemo(() => {
    if (!currentHub?.province) return null
    const cleanHubP = cleanAdminName(currentHub.province)
    return (vietnamAddressData as ProvinceItem[]).find(
      (p) => cleanAdminName(p.name) === cleanHubP
    ) || (vietnamAddressData as ProvinceItem[])[0]
  }, [currentHub?.province])

  // Danh sách Quận/Huyện của Tỉnh này
  const districts = useMemo(() => {
    return hubProvinceData?.districts || []
  }, [hubProvinceData])

  // Quận/Huyện hiện đang được chọn
  const currentDistrictData = useMemo(() => {
    if (!selectedDistrictName) return districts[0] || null
    return districts.find((d) => d.name === selectedDistrictName) || districts[0] || null
  }, [districts, selectedDistrictName])

  // Danh sách Phường/Xã của Quận đã chọn
  const wards = useMemo(() => {
    return currentDistrictData?.wards || []
  }, [currentDistrictData])

  // Reset form khi modal mở ra
  useEffect(() => {
    if (!isOpen) return

    setName('')
    setPhone('')
    setVehicleNumber('')
    setVehicleType(isSoc ? 'TRUCK' : initialVehicleType === 'TRUCK' ? 'MOTORBIKE' : initialVehicleType)
    setEmail('')
    setPassword('123456')
    setCustomRouteNote('')
    setSelectedWards([])

    // Tự động chọn Quận/Huyện của Bưu Cục
    if (currentHub?.district && districts.length > 0) {
      const cleanHubD = cleanAdminName(currentHub.district)
      const matchedD = districts.find((d) => cleanAdminName(d.name) === cleanHubD)
      if (matchedD) {
        setSelectedDistrictName(matchedD.name)
        if (currentHub.ward) {
          const matchedW = matchedD.wards.find((w) => cleanAdminName(w.name) === cleanAdminName(currentHub.ward || ''))
          if (matchedW) {
            setSelectedWards([matchedW.name])
          }
        }
      } else {
        setSelectedDistrictName(districts[0]?.name || '')
      }
    } else if (districts.length > 0) {
      setSelectedDistrictName(districts[0].name)
    }
  }, [isOpen, currentHub, isSoc, initialVehicleType, districts])

  // Toggle chọn Phường/Xã trong tuyến
  const handleToggleWard = (wardName: string) => {
    setSelectedWards((prev) => {
      if (prev.includes(wardName)) {
        return prev.filter((w) => w !== wardName)
      } else {
        return [...prev, wardName]
      }
    })
  }

  // Chọn toàn bộ hoặc bỏ chọn toàn bộ Phường trong Quận
  const handleSelectAllWards = () => {
    if (selectedWards.length === wards.length) {
      setSelectedWards([])
    } else {
      setSelectedWards(wards.map((w) => w.name))
    }
  }

  // Tính toán chuỗi tuyến đường phụ trách hoàn chỉnh
  const computedOperatingArea = useMemo(() => {
    if (isSoc) {
      return customRouteNote.trim() || `Tuyến xe tải xuất phát từ ${currentHub?.name}`
    }

    const parts: string[] = []
    if (customRouteNote.trim()) {
      parts.push(customRouteNote.trim())
    }
    if (selectedWards.length > 0) {
      parts.push(selectedWards.join(', '))
    }
    if (selectedDistrictName) {
      parts.push(selectedDistrictName)
    }
    if (currentHub?.province) {
      parts.push(currentHub.province)
    }

    return parts.join(', ') || `${currentHub?.district || ''}, ${currentHub?.province || ''}`
  }, [isSoc, customRouteNote, selectedWards, selectedDistrictName, currentHub])

  // Khởi tạo bản đồ trực quan khi chuyển sang Tab MAP
  useEffect(() => {
    if (!isOpen || activeTab !== 'MAP') {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
      return
    }

    const timer = setTimeout(() => {
      const L = (window as any).L
      if (!L || !mapContainerRef.current) return

      const lat = currentHub?.latitude || (currentHub?.province?.includes('Hải Phòng') ? 20.8606 : 10.7769)
      const lng = currentHub?.longitude || (currentHub?.province?.includes('Hải Phòng') ? 106.6804 : 106.7009)

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
      }).setView([lat, lng], 14)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(map)

      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // Marker bưu cục
      const hubIcon = L.divIcon({
        className: 'custom-hub-icon',
        html: `<div style="background-color:#059669;color:white;padding:4px 8px;border-radius:12px;font-weight:900;font-size:11px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.2);display:flex;align-items:center;gap:4px;white-space:nowrap;border:2px solid white;">🏢 ${currentHub?.name || 'Bưu Cục'}</div>`,
        iconSize: [120, 30],
        iconAnchor: [60, 15],
      })

      L.marker([lat, lng], { icon: hubIcon }).addTo(map)

      // Vòng tròn bán kính phục vụ (Delivery Radius 4km)
      const circle = L.circle([lat, lng], {
        color: '#10b981',
        fillColor: '#34d399',
        fillOpacity: 0.18,
        radius: 3500,
        weight: 2,
        dashArray: '4, 6',
      }).addTo(map)

      circleInstanceRef.current = circle
      mapInstanceRef.current = map
    }, 150)

    return () => clearTimeout(timer)
  }, [isOpen, activeTab, currentHub])

  // Xử lý gửi Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !phone.trim() || !vehicleNumber.trim()) {
      alert('Vui lòng điền đầy đủ Họ Tên, Số Điện Thoại và Biển Số Xe!')
      return
    }

    if (!isSoc && vehicleType === 'TRUCK') {
      alert('Bưu cục giao hàng không được phép tuyển xe tải đường dài. Vui lòng chọn Xe Máy hoặc Xe Van!')
      return
    }

    setSubmitting(true)
    try {
      const cleanPhone = phone.trim()
      const fallbackEmail = `shipper_${cleanPhone.replace(/[^0-9]/g, '')}@spx.zeromall.vn`
      const driverEmail = email.trim() || fallbackEmail

      const res = await fetch(`${API_BASE_URL}/delivery/drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: cleanPhone,
          vehicleNumber: vehicleNumber.trim().toUpperCase(),
          vehicleType,
          hubId: currentHub?.id,
          assignedProvince: currentHub?.province,
          assignedDistrict: selectedDistrictName || currentHub?.district,
          operatingArea: computedOperatingArea,
          email: driverEmail,
          password: password.trim() || '123456',
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.message || 'Không thể tạo tài xế mới')
      }

      alert(
        `Tuyển / Thêm tài xế [${name.trim()}] thành công!\n` +
        `• Bưu cục: ${currentHub?.name}\n` +
        `• Tài khoản: ${driverEmail}\n` +
        `• Mật khẩu: ${password.trim() || '123456'} (Yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên)`
      )

      onSuccess()
      onClose()
    } catch (err: any) {
      alert('Lỗi: ' + (err.message || 'Đã có lỗi xảy ra khi tạo tài xế'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs text-left animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 relative max-h-[92vh] flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{isSoc ? '🚛' : '🛵'}</span>
              <h2 className="text-base font-black text-slate-900">
                {isSoc ? 'Đăng Ký Xe Tải Tuyến Đường Dài Mới' : 'Tuyển / Thêm Shipper Giao Nhận Mới'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Đơn vị chủ quản: <span className="font-bold text-emerald-700">{currentHub?.name}</span>{' '}
              <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                {currentHub?.code}
              </span>{' '}
              • {isSoc ? 'Kho Tổng Phân Loại (Mega SOC)' : 'Bưu Cục Giao Hàng (Last-Mile Hub)'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
          {/* SECTION 1: THÔNG TIN CÁ NHÂN & PHƯƠNG TIỆN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Họ Và Tên Tài Xế / Bác Tài <span className="text-rose-500">*</span>:
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Bùi Văn Hòa, Nguyễn Văn Giao..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Số Điện Thoại Liên Hệ <span className="text-rose-500">*</span>:
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0988123456"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Biển Số Xe Vận Chuyển <span className="text-rose-500">*</span>:
              </label>
              <input
                type="text"
                required
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="VD: 15-B1 999.88 hoặc 28-A1 123.45"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold uppercase focus:outline-none focus:border-emerald-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Loại Phương Tiện Phân Cấp:
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
              >
                {isSoc ? (
                  <>
                    <option value="TRUCK">🚛 Xe tải đường dài (Trung chuyển Linehaul liên tỉnh)</option>
                    <option value="VAN">🚐 Xe Van / Bán tải (Trung chuyển nội bộ)</option>
                  </>
                ) : (
                  <>
                    <option value="MOTORBIKE">🛵 Xe máy (Lấy & Giao nội thành tận nhà)</option>
                    <option value="VAN">🚐 Xe Van / Bán tải (Hàng cồng kềnh / Gom Shop lớn)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {!isSoc && (
            <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-2.5 flex items-start gap-2">
              <span className="text-base shrink-0">ℹ️</span>
              <p className="text-[11px] text-sky-800 leading-relaxed font-medium">
                <strong>Quy chuẩn bưu cục phát:</strong> Bưu cục (Delivery Hub) phụ trách phát bưu kiện chặng cuối (Last-mile) bằng Xe máy và Xe Van. Xe tải lớn chở tuyến Linehaul liên tỉnh do Trung tâm Mega SOC quản lý.
              </p>
            </div>
          )}

          {/* SECTION 2: TÀI KHOẢN ĐĂNG NHẬP CHO TÀI XẾ */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🔑</span>
                <span className="text-xs font-black text-slate-800">
                  Cấp Tài Khoản Ứng Dụng Cho Tài Xế (ZeroExpress Driver App)
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Mặc định: 123456
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Email / Gmail Đăng Nhập:
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={phone ? `shipper_${phone.replace(/[^0-9]/g, '')}@spx.zeromall.vn` : 'tài-xế@gmail.com'}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-600 transition"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Để trống để hệ thống tự cấp theo số điện thoại
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Mật Khẩu Ban Đầu:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mặc định: 123456"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-emerald-600 transition pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? '👁️' : '🙈'}
                  </button>
                </div>
                <p className="text-[10px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                  <span>🔒</span> Tài xế sẽ đổi mật khẩu ở lần đăng nhập đầu tiên
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 3: TUYẾN GIAO NHẬN PHỤ TRÁCH & BẢN ĐỒ / KHU VỰC */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">📍</span>
                <span className="text-xs font-black text-slate-800">
                  Tuyến Giao Nhận Phụ Trách ({currentHub?.province})
                </span>
              </div>

              {!isSoc && (
                <div className="flex bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveTab('AREAS')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      activeTab === 'AREAS'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    📋 Chọn Phường/Xã
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('MAP')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      activeTab === 'MAP'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    🗺️ Xem Bản Đồ
                  </button>
                </div>
              )}
            </div>

            {/* TAB 1: BỘ CHỌN KHU VỰC HÀNH CHÍNH & PHƯỜNG / XÃ */}
            {activeTab === 'AREAS' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Quận / Huyện Thuộc Tỉnh {currentHub?.province}:
                    </label>
                    <select
                      value={selectedDistrictName}
                      onChange={(e) => {
                        setSelectedDistrictName(e.target.value)
                        setSelectedWards([])
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 transition"
                    >
                      {districts.map((d) => (
                        <option key={d.code} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Ghi Chú Tuyến / Tên Trục Đường (Tùy Chọn):
                    </label>
                    <input
                      type="text"
                      value={customRouteNote}
                      onChange={(e) => setCustomRouteNote(e.target.value)}
                      placeholder={isSoc ? "VD: Tuyến Hải Phòng ⇄ Hà Nội SOC" : "VD: Tuyến 01 - Chợ Đổ, Đường Quang Trung..."}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-600 transition"
                    />
                  </div>
                </div>

                {!isSoc && wards.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-slate-700">
                        Chọn Các Phường / Xã Thuộc Tuyến Đi Phát ({selectedWards.length}/{wards.length}):
                      </span>
                      <button
                        type="button"
                        onClick={handleSelectAllWards}
                        className="text-[10px] text-emerald-700 hover:text-emerald-800 font-extrabold cursor-pointer"
                      >
                        {selectedWards.length === wards.length ? 'Bỏ chọn tất cả' : 'Chọn toàn bộ quận'}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200/80">
                      {wards.map((w) => {
                        const isSelected = selectedWards.includes(w.name)
                        return (
                          <button
                            key={w.code}
                            type="button"
                            onClick={() => handleToggleWard(w.name)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            <span>{isSelected ? '✓' : '+'}</span>
                            {w.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* TAB 2: BẢN ĐỒ PHỦ SÓNG BƯU CỤC */
              <div className="space-y-2">
                <div
                  ref={mapContainerRef}
                  className="w-full h-48 rounded-xl border border-slate-200 overflow-hidden shadow-inner bg-slate-100"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>🏢 Vị trí bưu cục: <b>{currentHub?.address}</b></span>
                  <span className="text-emerald-700 font-bold">🟢 Bán kính phủ sóng phát: 3.5 km</span>
                </div>
              </div>
            )}

            {/* PREVIEW CHUỖI ĐỊA BÀN PHỤ TRÁCH THỰC TẾ */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Chuỗi Tuyến Địa Bàn Sẽ Lưu Vào Hồ Sơ:
              </label>
              <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-medium leading-relaxed border border-slate-200">
                {computedOperatingArea}
              </div>
            </div>
          </div>

          {/* FOOTER BUTTONS */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              {submitting ? (
                <>
                  <span className="animate-spin inline-block">⏳</span> Đang tạo...
                </>
              ) : (
                <>
                  <span>✓</span> Xác Nhận Tuyển Tài Xế
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
