import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../../config/api.config'

interface CsShopProfileAuditsTabProps {
  user: any
  triggerAuditLog: (action: string) => Promise<void>
}

export const CsShopProfileAuditsTab: React.FC<CsShopProfileAuditsTabProps> = ({
  user,
  triggerAuditLog
}) => {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('PENDING')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null)
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const url = new URL(`${API_BASE_URL}/auth/shop-update-requests`)
      if (filterStatus && filterStatus !== 'ALL') {
        url.searchParams.append('status', filterStatus)
      }
      if (searchTerm.trim()) {
        url.searchParams.append('search', searchTerm.trim())
      }
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error('Không thể tải danh sách yêu cầu thay đổi')
      const data = await res.json()
      setRequests(data)
    } catch (err: any) {
      console.error(err)
      alert('Lỗi tải dữ liệu: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [filterStatus])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchRequests()
  }

  const handleApprove = async (req: any) => {
    if (!window.confirm(`Bạn có chắc chắn muốn PHÊ DUYỆT yêu cầu cập nhật của Shop "${req.shop?.name || req.oldData?.name}"? Các thông tin mới sẽ được áp dụng ngay lập tức trên ZeroMall.`)) {
      return
    }

    setActionLoading(true)
    try {
      const token = localStorage.getItem('zm_token') || ''
      const res = await fetch(`${API_BASE_URL}/auth/shop-update-requests/${req.id}/review`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'APPROVE',
          operatorEmail: user?.email || 'cs@zeromall.vn',
          operatorRole: user?.role || 'CS'
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.message || 'Phê duyệt thất bại')
      }

      await triggerAuditLog(`Phê duyệt thay đổi thông tin Shop "${req.shop?.name || req.oldData?.name}" (Yêu cầu #${req.id})`)
      alert('Đã phê duyệt thành công! Thông tin mới của shop đã được cập nhật.')
      setSelectedRequest(null)
      fetchRequests()
    } catch (err: any) {
      alert('Lỗi phê duyệt: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleOpenReject = (req: any) => {
    setSelectedRequest(req)
    setRejectionReason('')
    setRejectionModalOpen(true)
  }

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRequest) return
    if (!rejectionReason.trim()) {
      alert('Vui lòng nhập lý do từ chối cụ thể để người bán chỉnh sửa.')
      return
    }

    setActionLoading(true)
    try {
      const token = localStorage.getItem('zm_token') || ''
      const res = await fetch(`${API_BASE_URL}/auth/shop-update-requests/${selectedRequest.id}/review`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'REJECT',
          rejectionReason: rejectionReason.trim(),
          operatorEmail: user?.email || 'cs@zeromall.vn',
          operatorRole: user?.role || 'CS'
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.message || 'Từ chối thất bại')
      }

      await triggerAuditLog(`Từ chối thay đổi thông tin Shop "${selectedRequest.shop?.name}" lý do: ${rejectionReason.trim()}`)
      alert('Đã từ chối yêu cầu và gửi thông báo lý do tới Người bán.')
      setRejectionModalOpen(false)
      setSelectedRequest(null)
      fetchRequests()
    } catch (err: any) {
      alert('Lỗi từ chối: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const pendingCount = requests.filter(r => r.status === 'PENDING').length

  const renderFieldDiff = (label: string, oldVal: any, newVal: any) => {
    const isChanged = oldVal !== newVal
    if (!isChanged) return null

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            {label} (Hiện tại)
          </span>
          <div className="text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 break-words">
            {oldVal || <em className="text-slate-400">Chưa có</em>}
          </div>
        </div>
        <div>
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">
            {label} (Đề xuất thay đổi ✦)
          </span>
          <div className="text-emerald-900 bg-emerald-50/80 font-bold p-2.5 rounded-lg border border-emerald-300 break-words">
            {newVal || <em className="text-slate-400">Để trống</em>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-3xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-black text-slate-800">Kiểm Duyệt Hồ Sơ Shop</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
              {pendingCount} Chờ xử lý
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quy trình Shopee-Standard: Shop chỉ được đổi tên, logo, địa chỉ sau khi CSKH xác thực nhằm chống gian lận & bảo vệ người mua.
          </p>
        </div>

        {/* SEARCH & REFRESH */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <form onSubmit={handleSearch} className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Tìm theo tên shop, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 w-full sm:w-64"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Tìm
            </button>
          </form>

          <button
            onClick={fetchRequests}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition cursor-pointer"
            title="Làm mới danh sách"
          >
            🔄
          </button>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex gap-2 border-b border-slate-200 pb-3">
        {[
          { key: 'PENDING', label: '⏳ Chờ Duyệt', badge: pendingCount },
          { key: 'APPROVED', label: '✅ Đã Phê Duyệt' },
          { key: 'REJECTED', label: '❌ Bị Từ Chối' },
          { key: 'ALL', label: 'Tất Cả' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2 ${
              filterStatus === tab.key
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                filterStatus === tab.key ? 'bg-white text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* REQUESTS LIST */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200/80">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-500 mt-4">Đang tải danh sách hồ sơ cần kiểm duyệt...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200/80 text-center">
          <span className="text-4xl">📂</span>
          <h3 className="text-sm font-black text-slate-700 mt-3">Không có yêu cầu nào</h3>
          <p className="text-xs text-slate-400 mt-1">Hiện không có yêu cầu thay đổi hồ sơ shop nào ở trạng thái này.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const oldData = req.oldData || {}
            const newData = req.newData || {}
            const isNameChanged = oldData.name !== newData.name
            const isLogoChanged = oldData.logo !== newData.logo

            return (
              <div
                key={req.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-3xs overflow-hidden transition hover:border-slate-300"
              >
                {/* HEADER OF CARD */}
                <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={newData.logo || oldData.logo || 'https://placehold.co/100x100/10b981/ffffff?text=SHOP'}
                      alt="Logo"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-white"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-800">
                          {req.shop?.name || oldData.name}
                        </h3>
                        {isNameChanged && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded-full border border-emerald-200">
                            Đổi tên shop ➔ {newData.name}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1">
                        <span>ID Shop: <strong className="text-slate-600 font-mono">{req.shopId}</strong></span>
                        <span>•</span>
                        <span>Mã yêu cầu: <strong className="text-slate-600 font-mono">#{req.id.slice(0, 8)}</strong></span>
                        <span>•</span>
                        <span>Gửi lúc: {new Date(req.createdAt).toLocaleString('vi-VN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* STATUS BADGE */}
                  <div>
                    {req.status === 'PENDING' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5 animate-pulse">
                        ⏳ Chờ Phê Duyệt
                      </span>
                    ) : req.status === 'APPROVED' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                        ✅ Đã Phê Duyệt
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5">
                        ❌ Bị Từ Chối
                      </span>
                    )}
                  </div>
                </div>

                {/* BODY: SIDE-BY-SIDE DIFF */}
                <div className="p-5 space-y-4">
                  {/* SELLER'S REASON */}
                  <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-900">
                    <span className="font-black">📝 Lý do thay đổi của Shop:</span>{' '}
                    <span className="italic">{req.reason || 'Không cung cấp'}</span>
                  </div>

                  {/* DIFF HIGHLIGHTS */}
                  <div className="space-y-2.5">
                    {renderFieldDiff('Tên hiển thị Shop', oldData.name, newData.name)}
                    {renderFieldDiff('Số điện thoại liên hệ', oldData.phone, newData.phone)}
                    {renderFieldDiff('Email đại diện', oldData.email, newData.email)}
                    {renderFieldDiff('Địa chỉ kho / Lấy hàng ZMX', oldData.pickupAddress, newData.pickupAddress)}
                    {renderFieldDiff('Mô tả giới thiệu Shop', oldData.description, newData.description)}

                    {/* LOGO DIFF */}
                    {isLogoChanged && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Logo Hiện tại
                          </span>
                          <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-slate-200">
                            <img
                              src={oldData.logo || 'https://placehold.co/80x80/cbd5e1/ffffff?text=Logo'}
                              alt="Old"
                              className="w-12 h-12 rounded-lg object-cover border"
                            />
                            <span className="text-[10px] text-slate-500 break-all">{oldData.logo || 'Chưa có logo'}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">
                            Logo Mới Đề Xuất ✦
                          </span>
                          <div className="flex items-center gap-3 bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-300">
                            <img
                              src={newData.logo || 'https://placehold.co/80x80/10b981/ffffff?text=New'}
                              alt="New"
                              className="w-12 h-12 rounded-lg object-cover border border-emerald-300"
                            />
                            <span className="text-[10px] text-emerald-800 break-all">{newData.logo}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AUDIT INFO IF REVIEWED */}
                  {req.reviewedBy && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-bold">Nhân viên xử lý:</span> {req.reviewedBy} (
                        {req.reviewedAt ? new Date(req.reviewedAt).toLocaleString('vi-VN') : 'N/A'})
                      </div>
                      {req.rejectionReason && (
                        <div className="text-rose-600 font-bold">
                          Lý do từ chối: {req.rejectionReason}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ACTION CONTROLS */}
                  {req.status === 'PENDING' && (
                    <div className="flex justify-end items-center gap-3 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => handleOpenReject(req)}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition cursor-pointer"
                      >
                        ❌ Từ Chối Yêu Cầu
                      </button>
                      <button
                        onClick={() => handleApprove(req)}
                        disabled={actionLoading}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5"
                      >
                        <span>✅</span> Phê Duyệt & Cập Nhật Shop
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* REJECTION MODAL */}
      {rejectionModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">⚠️</span>
                <h3 className="text-base font-black text-slate-800">
                  Từ Chối Thay Đổi Hồ Sơ
                </h3>
              </div>
              <button
                onClick={() => setRejectionModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <p className="text-xs text-slate-600">
                Bạn đang từ chối yêu cầu của Shop{' '}
                <strong className="text-slate-800">
                  {selectedRequest.shop?.name || selectedRequest.oldData?.name}
                </strong>
                . Vui lòng nhập lý do rõ ràng để người bán biết và chỉnh sửa hợp lệ.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Lý do từ chối (Hiển thị trực tiếp cho Người bán) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Ví dụ: Tên shop chứa ký tự cấm vi phạm chính sách nhãn hiệu; hoặc địa chỉ kho chưa có số nhà cụ thể..."
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectionModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
                >
                  {actionLoading ? 'Đang xử lý...' : 'Xác Nhận Từ Chối'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
