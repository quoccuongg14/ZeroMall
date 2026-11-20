import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../../config/api.config'
import { LockShopModal } from '../admin/LockShopModal'
import { ShopDetailModal } from '../admin/ShopDetailModal'

interface CsShopsTabProps {
  shops: any[]
  fetchShops: () => void
  triggerAuditLog: (action: string) => Promise<void>
  loading: boolean
}

export const CsShopsTab: React.FC<CsShopsTabProps> = ({
  shops,
  fetchShops,
  triggerAuditLog,
  loading,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('PENDING_APPROVAL')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [selectedDetailShop, setSelectedDetailShop] = useState<any | null>(null)
  const [selectedLockShop, setSelectedLockShop] = useState<any | null>(null)
  const [currentTime, setCurrentTime] = useState<number>(Date.now())

  // Cập nhật bộ đếm thời gian thực mỗi giây để đếm ngược hạn khóa chính xác
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Đếm số lượng theo trạng thái dựa trên toàn bộ dữ liệu thực tế
  const countAll = shops.length
  const countPending = shops.filter((s) => s.status === 'PENDING_APPROVAL').length
  const countApproved = shops.filter((s) => s.status === 'APPROVED').length
  const countBlocked = shops.filter((s) => s.status === 'BLOCKED').length
  const countRejected = shops.filter((s) => s.status === 'REJECTED').length

  // Hàm tính toán và định dạng thời gian khóa còn lại
  const getBanCountdown = (blockedUntil?: string | null) => {
    if (!blockedUntil) {
      return {
        text: 'Khóa vĩnh viễn',
        type: 'permanent',
        icon: '🔒',
        endDate: null,
      }
    }

    const target = new Date(blockedUntil).getTime()
    const diff = target - currentTime

    if (diff <= 0) {
      return {
        text: 'Đã hết hạn khóa (Có thể mở lại)',
        type: 'expired',
        icon: '⚠️',
        endDate: new Date(blockedUntil).toLocaleString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      }
    }

    const totalSeconds = Math.floor(diff / 1000)
    const days = Math.floor(totalSeconds / (24 * 3600))
    const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    let timeString = ''
    if (days > 0) {
      timeString = `${days} ngày ${hours}h ${minutes}p`
    } else if (hours > 0) {
      timeString = `${hours}h ${minutes}p ${seconds}s`
    } else {
      timeString = `${minutes}p ${seconds}s`
    }

    return {
      text: `Còn lại: ${timeString}`,
      type: 'countdown',
      icon: '⏳',
      endDate: new Date(blockedUntil).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    }
  }

  // Mở trang Storefront gian hàng kèm thanh điều hành ZERO CONTROL
  const handleOpenStorefront = (shopId: string) => {
    const isSubdomain = window.location.hostname.endsWith('.zeromall.local')
    if (isSubdomain) {
      const buyerPort = window.location.port ? `:${window.location.port}` : ''
      const protocol = window.location.protocol
      const rawUser = localStorage.getItem('zm_user') || ''
      const rawToken = localStorage.getItem('zm_token') || ''
      const ssoUser = encodeURIComponent(rawUser)
      const ssoToken = encodeURIComponent(rawToken)
      window.open(
        `${protocol}//zeromall.local${buyerPort}/shop/${shopId}?sso_user=${ssoUser}&sso_token=${ssoToken}`,
        '_blank'
      )
    } else {
      window.open(`/shop/${shopId}`, '_blank')
    }
  }

  // Phê duyệt hoặc từ chối đơn đăng ký shop
  const handleApproveOrReject = async (shopId: string, status: string, shopName?: string) => {
    const actionLabel = status === 'APPROVED' ? 'phê duyệt kích hoạt' : 'từ chối đăng ký'
    if (!window.confirm(`Xác nhận ${actionLabel} cho gian hàng "${shopName || shopId}"?`)) {
      return
    }

    setActionLoadingId(shopId)
    try {
      const response = await fetch(`${API_BASE_URL}/auth/shops/${shopId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.message || 'Không thể cập nhật trạng thái cửa hàng')
      }
      await triggerAuditLog(`[CS PORTAL] ${actionLabel.toUpperCase()} gian hàng "${shopName || shopId}" (ID: ${shopId})`)
      alert(`✅ Đã ${actionLabel} thành công cho gian hàng!`)
      fetchShops()
    } catch (err: any) {
      alert(`⚠️ Lỗi: ${err.message}`)
    } finally {
      setActionLoadingId(null)
    }
  }

  // Mở khóa hoạt động trực tiếp cho shop đang bị khóa
  const handleUnblockShop = async (shop: any) => {
    if (!window.confirm(`Xác nhận mở khóa hoạt động lại cho cửa hàng "${shop.name}" (Mã: ${shop.id})?`)) {
      return
    }

    setActionLoadingId(shop.id)
    try {
      const res = await fetch(`${API_BASE_URL}/auth/shops/${shop.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED', blockedUntil: null, blockReason: null }),
      })

      if (res.ok) {
        await triggerAuditLog(`[CS PORTAL] Mở khóa hoạt động cho cửa hàng "${shop.name}" (Mã: ${shop.id})`)
        alert(`✅ Đã mở khóa hoạt động thành công cho gian hàng "${shop.name}"!`)
        fetchShops()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.message || 'Lỗi khi mở khóa cửa hàng')
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi kết nối khi mở khóa cửa hàng')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Lọc danh sách theo từ khóa tìm kiếm và bộ lọc trạng thái
  const filteredShops = shops.filter((s) => {
    const q = searchTerm.toLowerCase().trim()
    const matchQuery =
      !q ||
      s.name?.toLowerCase().includes(q) ||
      s.id?.toLowerCase().includes(q) ||
      s.owner?.name?.toLowerCase().includes(q) ||
      s.ownerId?.toLowerCase().includes(q) ||
      s.phoneNumber?.includes(q) ||
      s.email?.toLowerCase().includes(q)

    const matchStatus = statusFilter === 'ALL' || s.status === statusFilter

    return matchQuery && matchStatus
  })

  return (
    <>
      {/* 1. Statistics Dashboard Banner (5 chỉ số thời gian thực) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`bg-white border rounded-xl p-4 shadow-2xs cursor-pointer transition ${
            statusFilter === 'ALL' ? 'border-slate-800 ring-2 ring-slate-800/10' : 'border-slate-200/70 hover:border-slate-400'
          }`}
        >
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng cửa hàng</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{countAll}</p>
          <p className="text-[9px] text-slate-400 font-semibold mt-1">Toàn sàn ZeroMall</p>
        </div>

        <div
          onClick={() => setStatusFilter('PENDING_APPROVAL')}
          className={`bg-white border rounded-xl p-4 shadow-2xs cursor-pointer transition ${
            statusFilter === 'PENDING_APPROVAL' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200/70 hover:border-amber-400'
          }`}
        >
          <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider flex items-center gap-1">
            <span>⏳</span> Chờ phê duyệt
          </p>
          <p className="text-2xl font-black text-amber-600 mt-1">{countPending}</p>
          <p className="text-[9px] text-amber-700/70 font-semibold mt-1">Cần CSKH xét duyệt</p>
        </div>

        <div
          onClick={() => setStatusFilter('APPROVED')}
          className={`bg-white border rounded-xl p-4 shadow-2xs cursor-pointer transition ${
            statusFilter === 'APPROVED' ? 'border-emerald-600 ring-2 ring-emerald-600/20' : 'border-slate-200/70 hover:border-emerald-400'
          }`}
        >
          <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
            <span>✅</span> Đang hoạt động
          </p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{countApproved}</p>
          <p className="text-[9px] text-emerald-700/70 font-semibold mt-1">Đang kinh doanh bình thường</p>
        </div>

        <div
          onClick={() => setStatusFilter('BLOCKED')}
          className={`bg-white border rounded-xl p-4 shadow-2xs cursor-pointer transition ${
            statusFilter === 'BLOCKED' ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200/70 hover:border-rose-400'
          }`}
        >
          <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider flex items-center gap-1">
            <span>🔒</span> Đang bị khóa
          </p>
          <p className="text-2xl font-black text-rose-600 mt-1">{countBlocked}</p>
          <p className="text-[9px] text-rose-700/70 font-semibold mt-1">Đang thi hành kỷ luật</p>
        </div>

        <div
          onClick={() => setStatusFilter('REJECTED')}
          className={`bg-white border rounded-xl p-4 shadow-2xs cursor-pointer transition ${
            statusFilter === 'REJECTED' ? 'border-slate-500 ring-2 ring-slate-500/20' : 'border-slate-200/70 hover:border-slate-400'
          }`}
        >
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
            <span>❌</span> Bị từ chối
          </p>
          <p className="text-2xl font-black text-slate-600 mt-1">{countRejected}</p>
          <p className="text-[9px] text-slate-400 font-semibold mt-1">Yêu cầu bổ sung hồ sơ</p>
        </div>
      </div>

      {/* 2. Filters and Search controls */}
      <div className="bg-white border border-slate-200/70 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
          {[
            { id: 'PENDING_APPROVAL', label: `⏳ Chờ phê duyệt (${countPending})` },
            { id: 'APPROVED', label: `✅ Đang hoạt động (${countApproved})` },
            { id: 'BLOCKED', label: `🔒 Đang bị khóa (${countBlocked})` },
            { id: 'REJECTED', label: `❌ Bị từ chối (${countRejected})` },
            { id: 'ALL', label: `🌐 Tất cả (${countAll})` },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer border ${
                statusFilter === filter.id
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-3xs'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-80 relative">
          <input
            type="text"
            placeholder="Tìm theo tên shop, ID, chủ sở hữu, SĐT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-emerald-500 focus:bg-white transition"
          />
          <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 3. Grid content list of shops */}
      {loading ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-100 shadow-2xs">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider animate-pulse">
            Đang tải dữ liệu cửa hàng thực tế...
          </p>
        </div>
      ) : filteredShops.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-100 shadow-2xs space-y-2">
          <span className="text-3xl">📭</span>
          <p className="text-sm font-extrabold text-slate-500">Không tìm thấy cửa hàng nào trong bộ lọc này</p>
          <p className="text-xs text-slate-400">Hãy thử đổi bộ lọc hoặc tìm kiếm bằng từ khóa khác</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredShops.map((shop) => {
            const countdown = shop.status === 'BLOCKED' ? getBanCountdown(shop.blockedUntil) : null

            return (
              <div
                key={shop.id}
                className={`bg-white border rounded-xl p-5 shadow-2xs flex flex-col justify-between transition duration-200 ${
                  shop.status === 'BLOCKED'
                    ? 'border-rose-300 ring-1 ring-rose-500/10'
                    : shop.status === 'PENDING_APPROVAL'
                    ? 'border-amber-200/80 hover:border-amber-400'
                    : 'border-slate-200/70 hover:border-emerald-500/40'
                }`}
              >
                <div>
                  {/* Shop Header */}
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">🏪</span>
                        <h4 className="text-sm font-black text-slate-800 truncate" title={shop.name}>
                          {shop.name}
                        </h4>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {shop.id}</p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wide border shrink-0 ${
                        shop.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : shop.status === 'PENDING_APPROVAL'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : shop.status === 'REJECTED'
                          ? 'bg-slate-50 text-slate-600 border-slate-200'
                          : shop.status === 'BLOCKED'
                          ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {shop.status === 'PENDING_APPROVAL'
                        ? '⏳ Chờ phê duyệt'
                        : shop.status === 'APPROVED'
                        ? '✅ Đang hoạt động'
                        : shop.status === 'REJECTED'
                        ? '❌ Bị từ chối'
                        : shop.status === 'BLOCKED'
                        ? '🔒 Đang bị khóa'
                        : shop.status}
                    </span>
                  </div>

                  {/* BAN NOTIFICATION BANNER (Hiển thị nổi bật khi shop bị khóa) */}
                  {shop.status === 'BLOCKED' && countdown && (
                    <div className="mt-3.5 bg-rose-50/90 border border-rose-200 rounded-xl p-3 space-y-1.5 text-xs text-left">
                      <div className="flex items-center justify-between font-black text-rose-700">
                        <span className="flex items-center gap-1.5">
                          <span>{countdown.icon}</span> {countdown.text}
                        </span>
                        {countdown.endDate && (
                          <span className="text-[10px] text-rose-500 font-medium">Hết hạn: {countdown.endDate}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-rose-800 font-semibold leading-relaxed">
                        <span className="font-bold">Lý do khóa:</span> {shop.blockReason || 'Vi phạm chính sách sàn ZeroMall'}
                      </p>
                    </div>
                  )}

                  {/* Shop Details */}
                  <div className="mt-3.5 space-y-2.5 border-t border-b border-slate-100 py-3 text-slate-650">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-400 uppercase text-[9px]">Chủ sở hữu</span>
                      <span className="font-semibold text-slate-700 truncate max-w-[220px]" title={shop.owner?.name || shop.ownerId}>
                        {shop.owner?.name || shop.ownerId}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-400 uppercase text-[9px]">Email / SĐT</span>
                      <span className="font-semibold text-slate-700">
                        {shop.email || 'N/A'} {shop.phoneNumber ? `• ${shop.phoneNumber}` : ''}
                      </span>
                    </div>

                    {/* Pickup Address */}
                    <div className="flex flex-col gap-1 pt-0.5">
                      <span className="font-bold text-slate-400 uppercase text-[9px] flex items-center gap-1">
                        <span>📦</span> Địa chỉ lấy hàng
                      </span>
                      {(() => {
                        let pickup: any = null
                        if (shop.pickupAddress) {
                          try {
                            pickup = typeof shop.pickupAddress === 'string' ? JSON.parse(shop.pickupAddress) : shop.pickupAddress
                          } catch {
                            pickup = null
                          }
                        }

                        if (!pickup || typeof pickup !== 'object') {
                          return (
                            <p className="text-slate-500 italic text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                              {shop.pickupAddress || 'Chưa cung cấp'}
                            </p>
                          )
                        }

                        const fullAddress = [pickup.detailAddress, pickup.ward, pickup.district, pickup.province]
                          .filter(Boolean)
                          .join(', ')

                        return (
                          <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/70 space-y-1 text-xs">
                            <div className="flex items-center justify-between pb-1 border-b border-slate-200/50">
                              <span className="font-bold text-slate-800 flex items-center gap-1">
                                <span>👤</span> {pickup.fullName || 'Người liên hệ'}
                              </span>
                              <span className="font-semibold text-slate-600 flex items-center gap-1">
                                <span>📞</span> {pickup.phoneNumber || shop.phoneNumber || 'N/A'}
                              </span>
                            </div>
                            <p className="text-slate-700 font-medium flex items-start gap-1 leading-snug">
                              <span className="shrink-0">📍</span>
                              <span>{fullAddress || 'Chưa có chi tiết địa chỉ'}</span>
                            </p>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Shipping Channels */}
                    <div className="flex flex-col gap-1 pt-0.5">
                      <span className="font-bold text-slate-400 uppercase text-[9px] flex items-center gap-1">
                        <span>🚚</span> Kênh vận chuyển kích hoạt
                      </span>
                      {(() => {
                        let shipping: any = null
                        if (shop.shippingSettings) {
                          try {
                            shipping = typeof shop.shippingSettings === 'string' ? JSON.parse(shop.shippingSettings) : shop.shippingSettings
                          } catch {
                            shipping = null
                          }
                        }

                        if (!shipping || typeof shipping !== 'object') {
                          return (
                            <p className="text-slate-400 italic text-[11px] bg-slate-50 p-2 rounded border border-slate-100">
                              {shop.shippingSettings || 'Cấu hình tiêu chuẩn'}
                            </p>
                          )
                        }

                        const channels = [
                          { key: 'express', label: 'Hỏa Tốc', icon: '⚡', enabled: !!shipping.express },
                          { key: 'fast', label: 'Nhanh', icon: '🚀', enabled: !!shipping.fast },
                          { key: 'saver', label: 'Tiết Kiệm', icon: '📦', enabled: !!shipping.saver },
                          { key: 'bulky', label: 'Cồng Kềnh', icon: '🚛', enabled: !!shipping.bulky },
                        ]

                        return (
                          <div className="grid grid-cols-4 gap-1.5 bg-slate-50/80 p-2 rounded-lg border border-slate-200/70">
                            {channels.map((ch) => (
                              <div
                                key={ch.key}
                                className={`flex flex-col items-center justify-center p-1 rounded text-[10px] font-bold border text-center ${
                                  ch.enabled
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-white text-slate-400 border-slate-200/50 opacity-50'
                                }`}
                              >
                                <span>{ch.icon}</span>
                                <span className="truncate w-full mt-0.5">{ch.label}</span>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </div>

                {/* Action Buttons Footer theo từng trạng thái */}
                <div className="mt-4 pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                  {/* Trạng thái 1: CHỜ PHÊ DUYỆT */}
                  {shop.status === 'PENDING_APPROVAL' && (
                    <>
                      <button
                        disabled={actionLoadingId === shop.id}
                        onClick={() => handleApproveOrReject(shop.id, 'APPROVED', shop.name)}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg text-xs cursor-pointer shadow-3xs transition duration-150 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {actionLoadingId === shop.id ? 'Đang duyệt...' : '✅ Phê Duyệt'}
                      </button>
                      <button
                        disabled={actionLoadingId === shop.id}
                        onClick={() => handleApproveOrReject(shop.id, 'REJECTED', shop.name)}
                        className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-black rounded-lg text-xs cursor-pointer border border-rose-200 transition duration-150 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {actionLoadingId === shop.id ? 'Đang từ chối...' : '❌ Từ Chối'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedDetailShop(shop)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer transition flex items-center gap-1"
                        title="Xem chi tiết hồ sơ cửa hàng"
                      >
                        <span>👁️</span> Hồ sơ
                      </button>
                    </>
                  )}

                  {/* Trạng thái 2: ĐANG HOẠT ĐỘNG */}
                  {shop.status === 'APPROVED' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenStorefront(shop.id)}
                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-xs cursor-pointer shadow-3xs transition flex items-center justify-center gap-1.5"
                      >
                        <span>🏪</span> Xem Trang Shop
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedLockShop(shop)}
                        className="py-2 px-3.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black rounded-lg text-xs cursor-pointer transition flex items-center gap-1 shadow-3xs"
                        title="Thiết lập thời hạn khóa và lý do kỷ luật"
                      >
                        <span>🔒</span> Khóa Shop
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedDetailShop(shop)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer transition flex items-center gap-1"
                        title="Xem chi tiết hồ sơ cửa hàng"
                      >
                        <span>👁️</span> Hồ sơ
                      </button>
                    </>
                  )}

                  {/* Trạng thái 3: ĐANG BỊ KHÓA */}
                  {shop.status === 'BLOCKED' && (
                    <>
                      <button
                        disabled={actionLoadingId === shop.id}
                        type="button"
                        onClick={() => handleUnblockShop(shop)}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg text-xs cursor-pointer shadow-3xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {actionLoadingId === shop.id ? 'Đang mở khóa...' : '🔓 Mở Khóa Hoạt Động'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenStorefront(shop.id)}
                        className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-black rounded-lg text-xs cursor-pointer transition flex items-center gap-1"
                        title="Kiểm tra storefront của shop"
                      >
                        <span>🏪</span> Storefront
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedDetailShop(shop)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer transition flex items-center gap-1"
                        title="Xem chi tiết hồ sơ cửa hàng"
                      >
                        <span>👁️</span> Hồ sơ
                      </button>
                    </>
                  )}

                  {/* Trạng thái 4: BỊ TỪ CHỐI */}
                  {shop.status === 'REJECTED' && (
                    <>
                      <button
                        disabled={actionLoadingId === shop.id}
                        type="button"
                        onClick={() => handleApproveOrReject(shop.id, 'APPROVED', shop.name)}
                        className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-black rounded-lg text-xs cursor-pointer transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {actionLoadingId === shop.id ? 'Đang duyệt lại...' : '♻️ Duyệt Kích Hoạt Lại'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedDetailShop(shop)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer transition flex items-center gap-1"
                        title="Xem chi tiết hồ sơ cửa hàng"
                      >
                        <span>👁️</span> Hồ sơ
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 4. MODAL KHÓA CỬA HÀNG (Có đặt hạn ngày & lý do kỷ luật) */}
      <LockShopModal
        isOpen={!!selectedLockShop}
        shop={selectedLockShop}
        onClose={() => setSelectedLockShop(null)}
        onSuccess={() => {
          setSelectedLockShop(null)
          fetchShops()
        }}
        triggerAuditLog={triggerAuditLog}
      />

      {/* 5. MODAL XEM CHI TIẾT HỒ SƠ CỬA HÀNG */}
      <ShopDetailModal
        isOpen={!!selectedDetailShop}
        shop={selectedDetailShop}
        onClose={() => setSelectedDetailShop(null)}
        onSuccess={fetchShops}
        triggerAuditLog={triggerAuditLog}
        onOpenLockModal={(shop) => {
          setSelectedDetailShop(null)
          setSelectedLockShop(shop)
        }}
      />
    </>
  )
}
