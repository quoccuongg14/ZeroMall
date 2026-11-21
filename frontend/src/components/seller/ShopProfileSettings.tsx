import React, { useState, useEffect, useRef } from 'react'
import { API_BASE_URL } from '../../config/api.config'
import { ShopAddressModal, type AddressData } from './ShopAddressModal'

interface ShopProfileSettingsProps {
  shop: any
  onRefreshShop: () => void
}

export const parsePickupAddress = (addr: any): AddressData => {
  if (!addr) {
    return {
      fullName: '',
      phoneNumber: '',
      province: '',
      district: '',
      ward: '',
      detailAddress: '',
    }
  }

  let obj: any = null
  if (typeof addr === 'object' && addr !== null) {
    obj = addr
  } else if (typeof addr === 'string') {
    const trimmed = addr.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        obj = JSON.parse(trimmed)
      } catch {
        obj = null
      }
    }
  }

  if (obj && typeof obj === 'object') {
    return {
      fullName: obj.fullName || '',
      phoneNumber: obj.phoneNumber || '',
      province: obj.province || '',
      district: obj.district || '',
      ward: obj.ward || '',
      detailAddress: obj.detailAddress || '',
      coordinates: obj.coordinates,
    }
  }

  return {
    fullName: '',
    phoneNumber: '',
    province: '',
    district: '',
    ward: '',
    detailAddress: typeof addr === 'string' ? addr : '',
  }
}

export const formatAddressText = (addr: any): string => {
  const parsed = parsePickupAddress(addr)
  const parts = [parsed.detailAddress, parsed.ward, parsed.district, parsed.province].filter(Boolean)
  if (parts.length === 0) return typeof addr === 'string' && !addr.startsWith('{') ? addr : '(Chưa cập nhật địa chỉ)'
  return parts.join(', ')
}

export const ShopProfileSettings: React.FC<ShopProfileSettingsProps> = ({ shop, onRefreshShop }) => {
  const [pendingRequest, setPendingRequest] = useState<any | null>(null)
  const [updateHistory, setUpdateHistory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  // Form edit state
  const [isEditing, setIsEditing] = useState(false)
  const [formName, setFormName] = useState('')
  const [formLogo, setFormLogo] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [pickupAddress, setPickupAddress] = useState<AddressData>({
    fullName: '',
    phoneNumber: '',
    province: '',
    district: '',
    ward: '',
    detailAddress: '',
  })
  const [formReason, setFormReason] = useState('')
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Address modal state
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4000)
  }

  const fetchRequestData = async () => {
    if (!shop?.id) return
    setIsLoading(true)
    try {
      const [pendingRes, historyRes] = await Promise.all([
        fetch(`${API_BASE_URL}/auth/shops/${shop.id}/profile-update-request`),
        fetch(`${API_BASE_URL}/auth/shops/${shop.id}/profile-update-history`)
      ])

      if (pendingRes.ok) {
        const data = await pendingRes.json()
        setPendingRequest(data || null)
      } else {
        setPendingRequest(null)
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json()
        setUpdateHistory(Array.isArray(historyData) ? historyData : [])
      }
    } catch (e) {
      console.error('Error fetching shop update request:', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (shop) {
      setFormName(shop.name || '')
      setFormLogo(shop.logo || '')
      setFormPhone(shop.phoneNumber || '')
      setFormEmail(shop.email || '')
      setFormDescription(shop.description || '')
      setPickupAddress(parsePickupAddress(shop.pickupAddress))
      fetchRequestData()
    }
  }, [shop?.id])

  // Handle image upload from local file
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      alert('Kích thước ảnh không được vượt quá 2MB.')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setFormLogo(reader.result as string)
      showToast('✓ Đã tải ảnh logo mới thành công!')
    }
    reader.readAsDataURL(file)
  }

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      alert('Vui lòng nhập tên cửa hàng.')
      return
    }
    if (!formPhone.trim()) {
      alert('Vui lòng nhập số điện thoại hotline cửa hàng.')
      return
    }
    if (!formReason.trim()) {
      alert('Vui lòng nhập lý do thay đổi thông tin để CSKH xét duyệt.')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        newData: {
          name: formName.trim(),
          logo: formLogo.trim(),
          phoneNumber: formPhone.trim(),
          email: formEmail.trim(),
          description: formDescription.trim(),
          pickupAddress: JSON.stringify(pickupAddress),
        },
        reason: formReason.trim(),
      }

      const res = await fetch(`${API_BASE_URL}/auth/shops/${shop.id}/profile-update-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Không thể gửi yêu cầu chỉnh sửa')

      showToast('✓ Đã gửi yêu cầu chỉnh sửa thông tin thành công. CSKH sẽ xét duyệt trong 24h.')
      setIsEditing(false)
      fetchRequestData()
      onRefreshShop()
    } catch (err: any) {
      alert(err.message || 'Lỗi gửi yêu cầu')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelRequest = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy yêu cầu chỉnh sửa đang chờ duyệt?')) return
    setIsCancelling(true)
    try {
      const res = await fetch(`${API_BASE_URL}/auth/shops/${shop.id}/profile-update-request`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Không thể hủy yêu cầu')
      showToast('✓ Đã hủy yêu cầu chỉnh sửa thông tin.')
      fetchRequestData()
      onRefreshShop()
    } catch (err: any) {
      alert(err.message || 'Lỗi hủy yêu cầu')
    } finally {
      setIsCancelling(false)
    }
  }

  const isPending = pendingRequest?.status === 'PENDING'
  const isRejected = pendingRequest?.status === 'REJECTED'

  const currentPickupAddress = parsePickupAddress(shop?.pickupAddress)

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-white rounded-3xl border border-slate-200">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400 mt-3 font-medium">Đang tải hồ sơ cửa hàng...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 text-left max-w-5xl">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white font-medium text-xs px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in duration-200">
          <span className="text-emerald-400 font-bold">✓</span> {toastMsg}
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <span>⚙️</span> Hồ Sơ & Thiết Lập Cửa Hàng
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
              Shopee Verified Standard
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Quản lý thông tin định danh & kho hàng. Nhằm chống gian lận và bảo vệ quyền lợi người mua, mọi thay đổi thông tin trọng yếu đều qua kiểm duyệt CSKH trong 24h.
          </p>
        </div>

        {!isEditing && !isPending && (
          <button
            type="button"
            onClick={() => {
              setFormName(shop.name || '')
              setFormLogo(shop.logo || '')
              setFormPhone(shop.phoneNumber || '')
              setFormEmail(shop.email || '')
              setFormDescription(shop.description || '')
              setPickupAddress(parsePickupAddress(shop.pickupAddress))
              setFormReason('')
              setIsEditing(true)
            }}
            className="px-4 py-2.5 bg-[#ee4d2d] hover:bg-[#d93b1d] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer shrink-0"
          >
            <span>✏️</span> Yêu Cầu Chỉnh Sửa Thông Tin
          </button>
        )}
      </div>

      {/* BANNERS: TRẠNG THÁI YÊU CẦU DUYỆT */}
      {isPending && (
        <div className="bg-amber-50/90 border border-amber-300 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3.5">
              <span className="text-3xl shrink-0">⏳</span>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h4 className="text-sm font-black text-amber-950">
                    Yêu Cầu Thay Đổi Thông Tin Đang Chờ CSKH Xét Duyệt
                  </h4>
                  <span className="bg-amber-200 text-amber-900 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                    Pending Review
                  </span>
                </div>
                <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                  Yêu cầu gửi lúc {new Date(pendingRequest.createdAt).toLocaleString('vi-VN')}. 
                  Trong thời gian chờ duyệt, cửa hàng vẫn hoạt động bình thường với thông tin hiện tại.
                </p>
                {pendingRequest.reason && (
                  <p className="text-xs text-amber-800 mt-1 font-medium bg-amber-100/70 p-2 rounded-lg inline-block border border-amber-200">
                    <span className="font-bold">Lý do thay đổi:</span> &ldquo;{pendingRequest.reason}&rdquo;
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCancelRequest}
              disabled={isCancelling}
              className="px-3.5 py-2 bg-white border border-amber-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 text-amber-900 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50 shrink-0 shadow-2xs"
            >
              {isCancelling ? 'Đang hủy...' : 'Hủy Yêu Cầu Này'}
            </button>
          </div>

          {/* Bảng so sánh thông tin cũ vs mới */}
          <div className="bg-white rounded-2xl p-4 border border-amber-200 text-xs space-y-2">
            <span className="font-bold text-amber-950 block">Chi tiết thông tin đề xuất thay đổi:</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingRequest.newData?.name && pendingRequest.newData.name !== pendingRequest.oldData?.name && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tên cửa hàng mới</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="line-through text-slate-400">{pendingRequest.oldData?.name}</span>
                    <span className="text-slate-400 font-bold">➔</span>
                    <span className="font-bold text-emerald-700">{pendingRequest.newData.name}</span>
                  </div>
                </div>
              )}

              {pendingRequest.newData?.phoneNumber && pendingRequest.newData.phoneNumber !== pendingRequest.oldData?.phoneNumber && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hotline mới</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="line-through text-slate-400">{pendingRequest.oldData?.phoneNumber}</span>
                    <span className="text-slate-400 font-bold">➔</span>
                    <span className="font-bold text-emerald-700 font-mono">{pendingRequest.newData.phoneNumber}</span>
                  </div>
                </div>
              )}

              {pendingRequest.newData?.email && pendingRequest.newData.email !== pendingRequest.oldData?.email && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email mới</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="line-through text-slate-400">{pendingRequest.oldData?.email || '(Trống)'}</span>
                    <span className="text-slate-400 font-bold">➔</span>
                    <span className="font-bold text-emerald-700">{pendingRequest.newData.email}</span>
                  </div>
                </div>
              )}

              {pendingRequest.newData?.pickupAddress && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 col-span-full">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Địa chỉ kho lấy hàng mới</span>
                  <div className="mt-1 text-emerald-800 font-medium">
                    📍 {formatAddressText(pendingRequest.newData.pickupAddress)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isRejected && !isEditing && (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 flex items-start gap-3.5 shadow-2xs">
          <span className="text-2xl shrink-0">❌</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-rose-900">
                Yêu Cầu Thay Đổi Thông Tin Gần Nhất Bị Từ Chối
              </h4>
              <span className="bg-rose-200 text-rose-900 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                Rejected
              </span>
            </div>
            <p className="text-xs text-rose-800 mt-1 leading-relaxed">
              <strong>Lý do từ CSKH:</strong> {pendingRequest.rejectionReason || 'Thông tin không đáp ứng quy chuẩn sàn hoặc địa chỉ kho không hợp lệ.'}
            </p>
            <p className="text-[11px] text-rose-600 mt-2">
              Nhấn <strong>&ldquo;Yêu Cầu Chỉnh Sửa Thông Tin&rdquo;</strong> ở góc phải phía trên để điều chỉnh và nộp lại hồ sơ.
            </p>
          </div>
        </div>
      )}

      {/* FORM CHỈNH SỬA THÔNG TIN */}
      {isEditing ? (
        <form onSubmit={handleSubmitRequest} className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="font-black text-slate-900 text-base">Cập Nhật Hồ Sơ & Kho Lấy Hàng</h3>
              <p className="text-xs text-slate-500 mt-0.5">Dữ liệu sau khi nộp sẽ được chuyển sang Cổng CSKH ZeroMall kiểm duyệt.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-xs text-slate-400 hover:text-slate-800 font-bold px-3 py-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              ✕ Hủy Bỏ
            </button>
          </div>

          <div className="space-y-6">
            {/* AVATAR / LOGO SECTION */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4.5 space-y-3">
              <label className="text-xs font-bold text-slate-700 block">Ảnh Đại Diện / Logo Cửa Hàng</label>
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <div className="relative group shrink-0">
                  <img
                    src={formLogo || `https://ui-avatars.com/api/?name=${encodeURIComponent(formName || 'Shop')}&background=0D8ABC&color=fff`}
                    alt="Logo Preview"
                    className="w-24 h-24 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-sm bg-white"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-slate-950/40 rounded-2xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[11px] font-bold cursor-pointer backdrop-blur-2xs"
                  >
                    Đổi Ảnh
                  </div>
                </div>

                <div className="space-y-2 flex-1 w-full text-xs">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-3xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span>📷</span> Tải Ảnh Từ Máy Tính
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const autoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(formName || 'Shop')}&background=0D8ABC&color=fff`
                        setFormLogo(autoUrl)
                        showToast('✓ Đã tạo logo tự động theo tên shop.')
                      }}
                      className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold transition cursor-pointer"
                    >
                      Tạo Logo Tự Động
                    </button>
                  </div>
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={formLogo}
                      onChange={(e) => setFormLogo(e.target.value)}
                      placeholder="Hoặc dán URL ảnh trực tiếp (https://...)"
                      className="w-full border border-slate-200 bg-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#ee4d2d]"
                    />
                    <p className="text-[10px] text-slate-400">Định dạng khuyên dùng: PNG, JPG vuông tỷ lệ 1:1, tối đa 2MB.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* THÔNG TIN ĐỊNH DANH CƠ BẢN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Tên Cửa Hàng Mới *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nhập tên shop..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-[#ee4d2d]"
                />
                <p className="text-[10px] text-slate-400">Không đặt từ khóa gây hiểu nhầm (Official, Mall) nếu chưa có ủy quyền thương hiệu.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Số Điện Thoại Hotline Shop *</label>
                <input
                  type="tel"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="09..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold focus:outline-none focus:border-[#ee4d2d]"
                />
                <p className="text-[10px] text-slate-400">Số điện thoại tiếp nhận cuộc gọi từ khách hàng và bưu tá lấy hàng ZMX.</p>
              </div>

              <div className="space-y-1 col-span-full md:col-span-1">
                <label className="text-xs font-bold text-slate-700">Email Cửa Hàng *</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="shop@zeromall.vn..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#ee4d2d]"
                />
                <p className="text-[10px] text-slate-400">Địa chỉ email nhận thông báo tài chính, đơn hàng và xử lý khiếu nại.</p>
              </div>

              <div className="space-y-1 col-span-full md:col-span-1">
                <label className="text-xs font-bold text-slate-700">Người Phụ Trách Kho</label>
                <input
                  type="text"
                  value={pickupAddress.fullName}
                  onChange={(e) => setPickupAddress({ ...pickupAddress, fullName: e.target.value })}
                  placeholder="Ví dụ: Kho Tổng Tân Bình / Quản Lý Kho..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#ee4d2d]"
                />
                <p className="text-[10px] text-slate-400">Tên người hoặc tên bãi kho để Shipper ZMX liên hệ khi bàn giao bưu kiện.</p>
              </div>
            </div>

            {/* ĐỊA CHỈ KHO LẤY HÀNG (PICKUP ADDRESS) */}
            <div className="bg-emerald-50/40 border border-emerald-200 rounded-2xl p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">📍</span>
                    <label className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                      Địa Chỉ Kho Xuất / Lấy Hàng (Pickup Hub)
                    </label>
                  </div>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Hệ thống phân định tuyến giao hàng ZeroExpress (ZMX) dựa trên toạ độ và phân cấp hành chính này.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <span>🗺️</span> Định Vị Bản Đồ & Chọn Địa Chỉ
                </button>
              </div>

              {/* CARD ĐỊA CHỈ HIỆN ĐANG CHỌN */}
              <div className="bg-white border border-emerald-200 rounded-xl p-4 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                      Kho Chuẩn ZMX
                    </span>
                    <span className="font-bold text-slate-800">
                      {pickupAddress.fullName || formName || 'Kho Shop'}
                    </span>
                    <span className="text-slate-400">|</span>
                    <span className="font-mono text-slate-600 font-bold">
                      {pickupAddress.phoneNumber || formPhone || '(Chưa có SĐT)'}
                    </span>
                  </div>
                </div>

                <p className="text-slate-700 font-medium leading-relaxed">
                  {formatAddressText(pickupAddress)}
                </p>

                {pickupAddress.coordinates?.lat && pickupAddress.coordinates?.lng && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100">
                    <span>Toạ độ GPS bưu tá:</span>
                    <span className="text-emerald-700 font-bold">
                      {pickupAddress.coordinates.lat.toFixed(5)}, {pickupAddress.coordinates.lng.toFixed(5)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* MÔ TẢ CỬA HÀNG */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Mô Tả / Giới Thiệu Cửa Hàng</label>
              <textarea
                rows={3}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Giới thiệu về sản phẩm, cam kết chất lượng, chính sách đổi trả của gian hàng..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#ee4d2d]"
              />
            </div>

            {/* LÝ DO THAY ĐỔI THÔNG TIN */}
            <div className="space-y-1.5 bg-amber-50/70 p-4 rounded-2xl border border-amber-200/90">
              <label className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                <span>📝</span> Lý Do Thay Đổi Thông Tin *
              </label>
              <textarea
                rows={2}
                required
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="Ví dụ: Cửa hàng mới chuyển địa điểm kho sang Quận Tân Bình; Cập nhật hotline tổng đài mới..."
                className="w-full border border-amber-300 bg-white rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#ee4d2d]"
              />
              <p className="text-[10px] text-amber-800">
                Lý do rõ ràng sẽ giúp chuyên viên CSKH ZeroMall phê duyệt hồ sơ của bạn nhanh chóng hơn.
              </p>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-[#ee4d2d] hover:bg-[#d93b1d] text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? 'Đang gửi hồ sơ...' : 'Gửi Yêu Cầu Cho CSKH Xét Duyệt ➔'}
            </button>
          </div>
        </form>
      ) : (
        /* ================= CARD HIỂN THỊ HỒ SƠ CHUẨN SHOPEE ================= */
        <div className="space-y-6">
          {/* 1. SHOP BRANDING & STATUS CARD */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <img
                  src={shop?.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(shop?.name || 'Shop')}&background=0D8ABC&color=fff`}
                  alt={shop?.name}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-200 shadow-2xs shrink-0 bg-slate-50"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-lg font-black text-slate-900">{shop?.name}</h3>
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Đang Hoạt Động
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                    <span>Mã Shop: <strong className="text-slate-600">{shop?.id}</strong></span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Tham gia sàn từ: {shop?.createdAt ? new Date(shop.createdAt).toLocaleDateString('vi-VN') : '2026'}
                  </p>
                </div>
              </div>

              {/* STATS OVERVIEW */}
              <div className="flex items-center gap-3 shrink-0 text-xs">
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-3 text-center">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Tỉ lệ phản hồi</span>
                  <span className="font-black text-emerald-600 text-sm">{shop?.responseRate || 100}%</span>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-3 text-center">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Thời gian phản hồi</span>
                  <span className="font-black text-slate-800 text-sm">{shop?.responseTime || 'trong vài phút'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. CHI TIẾT THÔNG TIN LIÊN HỆ & ĐỊA CHỈ KHO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* THÔNG TIN LIÊN HỆ */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>📞</span> Thông Tin Liên Hệ & Định Danh
              </h4>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Hotline Gian Hàng:</span>
                  <span className="font-bold text-slate-800 font-mono text-sm">
                    {shop?.phoneNumber || '(Chưa cập nhật)'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Email Chính Thức:</span>
                  <span className="font-bold text-slate-800">
                    {shop?.email || '(Chưa cập nhật)'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Chủ Sở Hữu Shop:</span>
                  <span className="font-bold text-slate-800">
                    {shop?.owner?.name || shop?.owner?.email || 'Chủ Gian Hàng'}
                  </span>
                </div>
              </div>
            </div>

            {/* ĐỊA CHỈ KHO LẤY HÀNG (PICKUP ADDRESS) */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🏢</span> Địa Chỉ Kho Xuất Hàng (Pickup Hub)
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Kho Mặc Định
                </span>
              </div>

              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">
                    {currentPickupAddress.fullName || shop?.name || 'Kho Cửa Hàng'}
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="font-mono text-emerald-800 font-bold">
                    {currentPickupAddress.phoneNumber || shop?.phoneNumber || '(Chưa có SĐT)'}
                  </span>
                </div>

                <p className="text-slate-700 font-medium leading-relaxed">
                  📍 {formatAddressText(shop?.pickupAddress)}
                </p>

                {currentPickupAddress.coordinates?.lat && currentPickupAddress.coordinates?.lng && (
                  <div className="text-[10px] text-slate-400 font-mono pt-1 border-t border-emerald-200/60">
                    Tọa độ GPS: {currentPickupAddress.coordinates.lat.toFixed(5)}, {currentPickupAddress.coordinates.lng.toFixed(5)}
                  </div>
                )}
              </div>
            </div>

            {/* MÔ TẢ GIAN HÀNG */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-3 col-span-full">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>📝</span> Giới Thiệu Cửa Hàng
              </h4>
              <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                {shop?.description || '(Chưa có phần giới thiệu gian hàng. Bạn có thể bấm "Yêu Cầu Chỉnh Sửa Thông Tin" để thêm mô tả.)'}
              </div>
            </div>
          </div>

          {/* 3. LỊCH SỬ XÉT DUYỆT THAY ĐỔI THÔNG TIN */}
          {updateHistory.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📜</span> Lịch Sử Yêu Cầu Thay Đổi Thông Tin ({updateHistory.length})
                </h4>
                <span className="text-[11px] text-slate-400">Ghi nhận tự động bởi Security & Audit Engine</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Thời Gian</th>
                      <th className="py-2.5 px-3">Lý Do Đề Xuất</th>
                      <th className="py-2.5 px-3">Thông Tin Thay Đổi</th>
                      <th className="py-2.5 px-3 text-center">Trạng Thái</th>
                      <th className="py-2.5 px-3">Phản Hồi CSKH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {updateHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-3 text-[11px] text-slate-500 font-mono whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-3 font-medium max-w-48 truncate" title={item.reason}>
                          {item.reason || '(Không ghi)'}
                        </td>
                        <td className="py-3 px-3 text-[11px]">
                          {item.newData?.name && <div className="font-bold text-slate-800">Tên: {item.newData.name}</div>}
                          {item.newData?.pickupAddress && (
                            <div className="text-slate-500 truncate max-w-56" title={formatAddressText(item.newData.pickupAddress)}>
                              Kho: {formatAddressText(item.newData.pickupAddress)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {item.status === 'PENDING' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                              ⏳ Chờ Duyệt
                            </span>
                          ) : item.status === 'APPROVED' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Đã Duyệt
                            </span>
                          ) : item.status === 'CANCELLED' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                              Đã Hủy
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                              ✕ Từ Chối
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-500">
                          {item.reviewedBy ? (
                            <div>
                              <span className="font-semibold text-slate-700">{item.reviewedBy}</span>
                              {item.rejectionReason && (
                                <div className="text-rose-600 font-medium mt-0.5">{item.rejectionReason}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Đang chờ xử lý...</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL ĐỊNH VỊ & CHỌN ĐỊA CHỈ KHO CHUẨN TMĐT */}
      <ShopAddressModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        initialAddress={pickupAddress}
        onSave={(newAddr) => {
          setPickupAddress(newAddr)
          if (!formPhone && newAddr.phoneNumber) {
            setFormPhone(newAddr.phoneNumber)
          }
          setIsAddressModalOpen(false)
          showToast('✓ Đã cập nhật địa chỉ kho lấy hàng trên bản đồ.')
        }}
      />
    </div>
  )
}
