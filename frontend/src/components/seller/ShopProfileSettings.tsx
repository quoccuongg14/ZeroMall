import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../../config/api.config'

interface ShopProfileSettingsProps {
  shop: any
  onRefreshShop: () => void
}

export const ShopProfileSettings: React.FC<ShopProfileSettingsProps> = ({ shop, onRefreshShop }) => {
  const [pendingRequest, setPendingRequest] = useState<any | null>(null)
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
  const [formAddress, setFormAddress] = useState('')
  const [formReason, setFormReason] = useState('')
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4000)
  }

  const fetchPendingRequest = async () => {
    if (!shop?.id) return
    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/auth/shops/${shop.id}/profile-update-request`)
      if (res.ok) {
        const data = await res.json()
        setPendingRequest(data || null)
      } else {
        setPendingRequest(null)
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
      setFormAddress(shop.pickupAddress || '')
      fetchPendingRequest()
    }
  }, [shop?.id])

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
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
          pickupAddress: formAddress.trim(),
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
      fetchPendingRequest()
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
      fetchPendingRequest()
      onRefreshShop()
    } catch (err: any) {
      alert(err.message || 'Lỗi hủy yêu cầu')
    } finally {
      setIsCancelling(false)
    }
  }

  const isPending = pendingRequest?.status === 'PENDING'
  const isRejected = pendingRequest?.status === 'REJECTED'

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400 mt-3">Đang tải thông tin hồ sơ shop...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 text-left max-w-5xl">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white font-medium text-xs px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2">
          <span>✓</span> {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>⚙️</span> Hồ Sơ & Thiết Lập Cửa Hàng
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý thông tin định danh cửa hàng. Theo chính sách sàn TMĐT, mọi thay đổi thông tin trọng yếu đều cần CSKH phê duyệt.
          </p>
        </div>

        {!isEditing && !isPending && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-[#ee4d2d] hover:bg-[#d93b1d] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>✏️</span> Yêu Cầu Chỉnh Sửa Thông Tin
          </button>
        )}
      </div>

      {/* BANNERS TRẠNG THÁI */}
      {isPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4.5 shadow-2xs space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">⏳</span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-amber-900">
                    Yêu Cầu Thay Đổi Thông Tin Đang Chờ CSKH Xét Duyệt
                  </h4>
                  <span className="bg-amber-200 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                    Pending Review
                  </span>
                </div>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  Yêu cầu gửi lúc {new Date(pendingRequest.createdAt).toLocaleString('vi-VN')}. 
                  Trong thời gian chờ duyệt, cửa hàng vẫn hoạt động bình thường với thông tin hiện tại.
                </p>
                {pendingRequest.reason && (
                  <p className="text-xs text-amber-700 italic mt-1">
                    Lý do yêu cầu: &quot;{pendingRequest.reason}&quot;
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCancelRequest}
              disabled={isCancelling}
              className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isCancelling ? 'Đang hủy...' : 'Hủy Yêu Cầu'}
            </button>
          </div>

          {/* Bảng so sánh thông tin đang xin đổi */}
          <div className="bg-white/80 rounded-xl p-3 border border-amber-200/60 text-xs">
            <span className="font-bold text-amber-900 block mb-2">Chi tiết thông tin xin cập nhật:</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-700">
              {pendingRequest.newData?.name && pendingRequest.newData.name !== pendingRequest.oldData?.name && (
                <div className="p-2 bg-amber-50/50 rounded-lg">
                  <span className="text-[11px] text-slate-400 block">Tên cửa hàng mới:</span>
                  <span className="line-through text-slate-400 mr-2">{pendingRequest.oldData?.name}</span>
                  ➔ <span className="font-bold text-emerald-700 ml-1">{pendingRequest.newData.name}</span>
                </div>
              )}
              {pendingRequest.newData?.phoneNumber && pendingRequest.newData.phoneNumber !== pendingRequest.oldData?.phoneNumber && (
                <div className="p-2 bg-amber-50/50 rounded-lg">
                  <span className="text-[11px] text-slate-400 block">Số điện thoại mới:</span>
                  <span className="line-through text-slate-400 mr-2">{pendingRequest.oldData?.phoneNumber}</span>
                  ➔ <span className="font-bold text-emerald-700 ml-1">{pendingRequest.newData.phoneNumber}</span>
                </div>
              )}
              {pendingRequest.newData?.email && pendingRequest.newData.email !== pendingRequest.oldData?.email && (
                <div className="p-2 bg-amber-50/50 rounded-lg">
                  <span className="text-[11px] text-slate-400 block">Email liên hệ mới:</span>
                  <span className="line-through text-slate-400 mr-2">{pendingRequest.oldData?.email}</span>
                  ➔ <span className="font-bold text-emerald-700 ml-1">{pendingRequest.newData.email}</span>
                </div>
              )}
              {pendingRequest.newData?.pickupAddress && pendingRequest.newData.pickupAddress !== pendingRequest.oldData?.pickupAddress && (
                <div className="p-2 bg-amber-50/50 rounded-lg col-span-full">
                  <span className="text-[11px] text-slate-400 block">Địa chỉ kho mới:</span>
                  <span className="font-bold text-emerald-700">{pendingRequest.newData.pickupAddress}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isRejected && !isEditing && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 shadow-2xs">
          <span className="text-2xl shrink-0">❌</span>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-rose-900">
              Yêu Cầu Thay Đổi Thông Tin Gần Nhất Đã Bị Từ Chối
            </h4>
            <p className="text-xs text-rose-800 mt-1">
              <strong>Lý do từ CSKH:</strong> {pendingRequest.rejectionReason || 'Thông tin không đáp ứng quy chuẩn sàn.'}
            </p>
            <p className="text-[11px] text-rose-600 mt-1">
              Bạn có thể điều chỉnh lại thông tin và bấm &quot;Yêu Cầu Chỉnh Sửa Thông Tin&quot; để gửi lại yêu cầu mới.
            </p>
          </div>
        </div>
      )}

      {/* FORM CHỈNH SỬA / XEM THÔNG TIN */}
      {isEditing ? (
        <form onSubmit={handleSubmitRequest} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Điền Thông Tin Cần Thay Đổi</h3>
              <p className="text-xs text-slate-500">Mọi thông tin sẽ được chuyển đến Cổng CSKH để xem xét phê duyệt.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-xs text-slate-500 hover:text-slate-800 font-bold"
            >
              Hủy Bỏ
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Tên Cửa Hàng Mới *</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nhập tên shop mới..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#ee4d2d]"
              />
              <p className="text-[10px] text-slate-400">Không sử dụng từ khóa Shopee Mall / Official nếu chưa có giấy phép.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Link Ảnh Logo / Avatar</label>
              <input
                type="text"
                value={formLogo}
                onChange={(e) => setFormLogo(e.target.value)}
                placeholder="https://..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#ee4d2d]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Số Điện Thoại Hotline *</label>
              <input
                type="text"
                required
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="09..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#ee4d2d]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Email Cửa Hàng *</label>
              <input
                type="email"
                required
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="shop@..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#ee4d2d]"
              />
            </div>

            <div className="space-y-1 col-span-full">
              <label className="text-xs font-bold text-slate-700">Địa Chỉ Kho Lấy Hàng (Pickup Address)</label>
              <input
                type="text"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="Số nhà, đường, phường, quận, tỉnh/thành..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#ee4d2d]"
              />
            </div>

            <div className="space-y-1 col-span-full">
              <label className="text-xs font-bold text-slate-700">Mô Tả / Giới Thiệu Shop</label>
              <textarea
                rows={3}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Giới thiệu về gian hàng, chính sách cam kết..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#ee4d2d]"
              />
            </div>

            <div className="space-y-1 col-span-full bg-orange-50/60 p-3 rounded-xl border border-orange-200/80">
              <label className="text-xs font-bold text-amber-900">Lý Do Thay Đổi Thông Tin *</label>
              <textarea
                rows={2}
                required
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="Ví dụ: Thay đổi địa chỉ kho mới chuyển sang Quận 7; Định vị lại thương hiệu sản phẩm..."
                className="w-full border border-orange-200 bg-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#ee4d2d]"
              />
              <p className="text-[10px] text-amber-800">Thông tin này là căn cứ để bộ phận CSKH & Kiểm Duyệt xét duyệt đơn của bạn.</p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#ee4d2d] hover:bg-[#d93b1d] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Đang gửi...' : 'Gửi Yêu Cầu Cho CSKH'}
            </button>
          </div>
        </form>
      ) : (
        /* CARD THÔNG TIN HIỆN TẠI */
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-4">
            <img
              src={shop?.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(shop?.name || 'Shop')}&background=0D8ABC&color=fff`}
              alt={shop?.name}
              className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shrink-0 shadow-2xs"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{shop?.name}</h3>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Đang hoạt động
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">Mã Shop: {shop?.id}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400 font-medium">Số điện thoại liên hệ:</span>
              <p className="font-bold text-slate-800">{shop?.phoneNumber || '(Chưa cập nhật)'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400 font-medium">Email chính thức:</span>
              <p className="font-bold text-slate-800">{shop?.email || '(Chưa cập nhật)'}</p>
            </div>
            <div className="space-y-1 col-span-full">
              <span className="text-slate-400 font-medium">Địa chỉ kho gửi/lấy hàng:</span>
              <p className="font-bold text-slate-800">{shop?.pickupAddress || '(Chưa cập nhật)'}</p>
            </div>
            <div className="space-y-1 col-span-full">
              <span className="text-slate-400 font-medium">Giới thiệu cửa hàng:</span>
              <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                {shop?.description || '(Chưa có mô tả)'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
